const { config, createAudioFromText } = require('tiktok-tts')

config('6858e2da587c053a54be5ef7d43c4b36', 'https://api16-normal-useast5.us.tiktokv.com/media/api/text/speech/invoke');

async function ttsToMP3(string, filename, voice = 'en_uk_001'){
    try {
        await createAudioFromText(string, filename, voice);
        console.log("Audio file generated!");
        return filename;
    }
    catch (err) {
        return "";
    }
}



module.exports.ttsToMP3 = ttsToMP3;