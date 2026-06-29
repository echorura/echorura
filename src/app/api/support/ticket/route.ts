import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 从请求头获取 JWT Token 校验用户身份
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // 注入当前用户的 Session Token 确保后续的数据库操作能正确通过 Row Level Security (RLS) 校验
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { username, content } = await req.json();

    if (!username || !content || !content.trim()) {
      return NextResponse.json({ error: '请输入反馈内容' }, { status: 400 });
    }

    // 1. 双写备份到 Memfire / Supabase 数据库支持工单表中，确保即便邮件发送失败也有案可查！
    const { error: dbError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        username: username,
        content: content.trim()
      });

    if (dbError) {
      console.error('[Ticket DB Error]', dbError);
      const errorMsg = dbError.message || (dbError as any).error_description || (dbError as any).error || '未知数据库错误';
      const errorDetails = dbError.details || (dbError as any).hint || '';
      const errorCode = dbError.code || 'N/A';
      const finalMsg = `${errorMsg}${errorDetails ? ' (' + errorDetails + ')' : ''} [Code: ${errorCode}]`;
      return NextResponse.json({ error: '工单登记失败: ' + finalMsg }, { status: 500 });
    }

    // 2. 尝试使用 SMTP 邮件代理服务器发送邮件给系统官方邮箱 echorura@piscesoul.cn
    const mailHost = process.env.SMTP_HOST || '';
    const mailPort = parseInt(process.env.SMTP_PORT || '465');
    const mailUser = process.env.SMTP_USER || '';
    const mailPass = process.env.SMTP_PASS || '';

    let emailSent = false;
    let emailWarning = '';

    if (mailHost && mailUser && mailPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: mailHost,
          port: mailPort,
          secure: mailPort === 465, // 465 使用 SSL 强加密
          auth: {
            user: mailUser,
            pass: mailPass,
          },
        });

        await transporter.sendMail({
          from: `"极声反馈工单系统" <${mailUser}>`,
          to: 'echorura@piscesoul.cn',
          subject: `【极声工单反馈】来自用户：${username}`,
          text: `【极声音乐意见反馈工单】\n\n用户姓名：${username}\n用户唯一ID：${user.id}\n绑定邮箱：${user.email || '无'}\n绑定电话：${user.phone || '无'}\n递交时间：${new Date().toLocaleString()}\n\n反馈内容如下：\n---------------------------------\n${content}\n---------------------------------`,
          html: `
            <div style="font-family: sans-serif; padding: 24px; background-color: #0f111a; color: #ffffff; border-radius: 16px; border: 1px solid #1f2937; max-width: 600px;">
              <h2 style="color: #00F0FF; margin-top: 0; font-style: italic; text-transform: uppercase;">⚡ 极声工单反馈服务 ⚡</h2>
              <p style="font-size: 14px; color: #9ca3af;">收到一笔来自极声音乐客户端的全新用户意见与问题反馈工单：</p>
              
              <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin: 20px 0;">
                <table style="width: 100%; font-size: 13px; color: #e5e7eb; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #9ca3af; width: 100px;"><strong>用户名：</strong></td>
                    <td style="padding: 6px 0;">${username}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9ca3af;"><strong>用户 ID：</strong></td>
                    <td style="padding: 6px 0; font-family: monospace; color: #EB00FF;">${user.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9ca3af;"><strong>绑定邮箱：</strong></td>
                    <td style="padding: 6px 0;">${user.email || '未绑定'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9ca3af;"><strong>绑定手机：</strong></td>
                    <td style="padding: 6px 0;">${user.phone || '未绑定'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9ca3af;"><strong>递交时间：</strong></td>
                    <td style="padding: 6px 0;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <h3 style="color: #EB00FF; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">📋 反馈内容正文</h3>
              <div style="background-color: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; font-size: 14px; line-height: 1.6; color: #ffffff; white-space: pre-wrap;">
${content}
              </div>

              <p style="font-size: 11px; color: #6b7280; margin-top: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                此邮件由 极声音乐 (ECHORURA) 工单模块自动发送。
              </p>
            </div>
          `,
        });
        emailSent = true;
      } catch (err: any) {
        console.error('[Ticket Email Error]', err);
        emailWarning = `。但发送至 echorura@piscesoul.cn 失败：${err.message}，请系统管理员检查 .env 中的 SMTP 账号密码配置。`;
      }
    } else {
      console.log('未配置 SMTP_HOST / SMTP_USER 等邮件环境变量。已跳过真实的邮件发送，工单已完美写入数据库备份。');
      emailWarning = '。由于未在 .env.local 中配置 SMTP 环境变量，工单以数据库直存备份形式提交成功！';
    }

    return NextResponse.json({
      success: true,
      message: `反馈成功提交${emailWarning}`
    });

  } catch (err: any) {
    console.error('[Ticket Server Error]', err);
    return NextResponse.json({ error: '服务器错误: ' + err.message }, { status: 500 });
  }
}
