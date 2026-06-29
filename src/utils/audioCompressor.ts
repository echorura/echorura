/**
 * 极声音乐（Jisheng Music）- 智能音频预压缩工具
 * 
 * 核心原理：
 * 1. 在浏览器端使用 Web Audio API 解码任意多媒体音频文件为 PCM 数组。
 * 2. 转换 32位浮点数 (Float32Array) 为 16位有符号整数 (Int16Array)。
 * 3. 采用 Inline Web Worker 后台计算线程，动态拉取 lamejs (MP3编码器) 资源，防止 UI 渲染主线程卡死。
 * 4. 采用 Transferable Objects 直接将大体积 PCM 缓存的所有权转移给 Worker 线程，实现 0ms 闪电传递。
 * 5. 将音频智能编码压缩为高品质 128kbps MP3，回传给主线程并封装为 File 对象。
 */

export interface CompressionProgress {
  progress: number; // 0-100
  status: 'decoding' | 'converting' | 'encoding' | 'done' | 'error';
  message: string;
  originalSize?: number;
  compressedSize?: number;
}

/**
 * 转换 Float32Array 采样为 Int16Array 采样
 */
function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // 裁剪动态范围，防止爆音失真
    const s = Math.max(-1.0, Math.min(1.0, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buffer;
}

/**
 * 浏览器端无损/有损智能音频压缩管线
 * @param file 原始上传文件
 * @param onProgress 进度回调函数
 * @param kbps 压缩比特率，默认 128 (符合流媒体黄金比例)
 */
export function compressAudioFile(
  file: File,
  onProgress: (state: CompressionProgress) => void,
  kbps: number = 128
): Promise<File> {
  return new Promise(async (resolve, reject) => {
    // 仅在浏览器环境下运行
    if (typeof window === 'undefined') {
      return reject(new Error('Audio compression can only run in the browser environment.'));
    }

    try {
      const originalSize = file.size;
      onProgress({
        status: 'decoding',
        progress: 10,
        message: '⚡ 正在解码源音频文件...',
        originalSize
      });

      // 1. 获取 AudioContext 用于解码
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('您的浏览器不支持 Web Audio API，无法进行音频优化！');
      }
      const audioCtx = new AudioContextClass();

      // 2. 读取文件并解码为 AudioBuffer
      const arrayBuffer = await file.arrayBuffer();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr: any) {
        throw new Error(`音频解码失败，请确认文件格式完整！(错误: ${decodeErr.message})`);
      } finally {
        audioCtx.close();
      }

      onProgress({
        status: 'converting',
        progress: 30,
        message: '⚡ 正在优化音频声学规格...',
        originalSize
      });

      // 3. 提取通道 PCM 数据
      const channels = Math.min(2, audioBuffer.numberOfChannels); // 强制最多双声道
      const sampleRate = audioBuffer.sampleRate;
      
      const leftFloat = audioBuffer.getChannelData(0);
      const rightFloat = channels === 2 ? audioBuffer.getChannelData(1) : null;

      // 4. 位深转换 Float32 -> Int16
      const leftInt16 = floatTo16BitPCM(leftFloat);
      const rightInt16 = rightFloat ? floatTo16BitPCM(rightFloat) : null;

      onProgress({
        status: 'encoding',
        progress: 40,
        message: '⚡ 极声声码引擎编码中: 0%',
        originalSize
      });

      // 5. 构建 Inline Web Worker 的代码字符串
      // 内置 LAME 算法分片流处理，并使用外部高速 CDN (jsDelivr) 载入 lamejs
      const workerCode = `
        self.onmessage = function(e) {
          try {
            const { left, right, channels, sampleRate, kbps } = e.data;
            
            // 载入纯 JS 的 LAME 编码模块
            importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');
            
            if (typeof lamejs === 'undefined') {
              throw new Error('Lamejs 编码器资源加载失败，请检查网络！');
            }

            const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
            
            const leftData = new Int16Array(left);
            const rightData = right ? new Int16Array(right) : null;
            
            const mp3Data = [];
            const chunkSize = 1152 * 10; // 分片处理以能够持续汇报进度，并防止内存溢出
            let offset = 0;
            
            while (offset < leftData.length) {
              const chunkLen = Math.min(chunkSize, leftData.length - offset);
              const leftChunk = leftData.subarray(offset, offset + chunkLen);
              const rightChunk = rightData ? rightData.subarray(offset, offset + chunkLen) : null;
              
              let mp3buf;
              if (channels === 2 && rightChunk) {
                mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
              } else {
                mp3buf = mp3encoder.encodeBuffer(leftChunk);
              }
              
              if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
              }
              
              offset += chunkLen;
              
              // 汇报编码百分比 (从 40% 到 98%)
              const progress = Math.min(99, Math.round((offset / leftData.length) * 100));
              self.postMessage({ type: 'progress', progress });
            }
            
            // 冲刷编码器缓存，写入结尾帧
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
              mp3Data.push(mp3buf);
            }
            
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            self.postMessage({ type: 'done', blob });
          } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
          }
        };
      `;

      // 6. 实例化 Web Worker (Blob URL 格式，彻底绕过打包限制)
      const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);

      // 7. 使用 Transferable 零拷贝传送大数据
      const transferables: ArrayBuffer[] = [leftInt16.buffer as ArrayBuffer];
      if (rightInt16) {
        transferables.push(rightInt16.buffer as ArrayBuffer);
      }

      worker.postMessage(
        {
          left: leftInt16.buffer,
          right: rightInt16 ? rightInt16.buffer : null,
          channels,
          sampleRate,
          kbps
        },
        transferables
      );

      // 8. 监听 Worker 的事件回传
      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          // 映射进度到 [40, 95] 区间
          const scaledProgress = Math.round(40 + (msg.progress * 55) / 100);
          onProgress({
            status: 'encoding',
            progress: scaledProgress,
            message: `⚡ 极声声码引擎编码中: ${msg.progress}%`,
            originalSize
          });
        } else if (msg.type === 'done') {
          const mp3Blob = msg.blob;
          
          // 释放 Blob URL，回收 Worker 线程
          URL.revokeObjectURL(workerUrl);
          worker.terminate();

          // 保持原文件名，但修改后缀为 .mp3
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const compressedFile = new File([mp3Blob], `${baseName}.mp3`, {
            type: 'audio/mp3',
            lastModified: Date.now()
          });

          onProgress({
            status: 'done',
            progress: 100,
            message: '🎉 智能预压缩已完成！音质已精细调谐。',
            originalSize,
            compressedSize: compressedFile.size
          });

          resolve(compressedFile);
        } else if (msg.type === 'error') {
          URL.revokeObjectURL(workerUrl);
          worker.terminate();
          reject(new Error(msg.error));
        }
      };

      worker.onerror = (err) => {
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        reject(new Error(`Web Worker 内部错误: ${err.message}`));
      };

    } catch (err: any) {
      onProgress({
        status: 'error',
        progress: 100,
        message: `❌ 优化失败: ${err.message}`
      });
      reject(err);
    }
  });
}
