const BODY = {
  en: 'Your Accel Business code is {code}. It works for 5 minutes. Do not share it.',
  hi: 'आपका Accel Business कोड {code} है। यह 5 मिनट चलेगा। इसे किसी को न बताएँ।',
  mr: 'तुमचा Accel Business कोड {code} आहे. तो 5 मिनिटे चालेल. तो कोणालाही सांगू नका.',
  bn: 'আপনার Accel Business কোড {code}। এটি ৫ মিনিট কাজ করবে। কাউকে জানাবেন না।',
  gu: 'તમારો Accel Business કોડ {code} છે. તે 5 મિનિટ ચાલશે. કોઈને જણાવશો નહીં.',
  kn: 'ನಿಮ್ಮ Accel Business ಕೋಡ್ {code}. ಇದು 5 ನಿಮಿಷ ಕೆಲಸ ಮಾಡುತ್ತದೆ. ಯಾರಿಗೂ ತಿಳಿಸಬೇಡಿ.',
  ml: 'നിങ്ങളുടെ Accel Business കോഡ് {code}. ഇത് 5 മിനിറ്റ് പ്രവർത്തിക്കും. ആരോടും പറയരുത്.',
  pa: 'ਤੁਹਾਡਾ Accel Business ਕੋਡ {code} ਹੈ। ਇਹ 5 ਮਿੰਟ ਚੱਲੇਗਾ। ਕਿਸੇ ਨੂੰ ਨਾ ਦੱਸੋ।',
  ta: 'உங்கள் Accel Business குறியீடு {code}. இது 5 நிமிடங்கள் செல்லும். யாரிடமும் சொல்லாதீர்கள்.',
  te: 'మీ Accel Business కోడ్ {code}. ఇది 5 నిమిషాలు పనిచేస్తుంది. ఎవరికీ చెప్పకండి.',
};

export async function sendOtpSms({ phone, code, lang }) {
  const url = process.env.SMS_API_URL;
  if (!url) return { delivered: false };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SMS_API_KEY ?? ''}` },
    body: JSON.stringify({ to: `+91${phone}`, message: (BODY[lang] ?? BODY.en).replace('{code}', code) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`SMS provider returned ${res.status}`);
  return { delivered: true };
}
