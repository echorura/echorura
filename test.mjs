import fs from "fs";

const fileBuffer = fs.readFileSync("tiny.wav");
const blob = new Blob([fileBuffer], { type: "audio/wav" });

const form = new FormData();
form.append("file", blob, "tiny.wav");
form.append("model", "FunAudioLLM/SenseVoiceSmall");

fetch("https://api.siliconflow.cn/v1/audio/transcriptions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-saydbqmuxozkqivekwxsugoelnrbvqhoxbsicyskrcuohuju"
  },
  body: form
})
.then(r => r.text())
.then(data => console.log(data))
.catch(console.error);
