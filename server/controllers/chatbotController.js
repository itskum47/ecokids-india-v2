const axios = require('axios');

const INVOKE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const STREAM = true;

const LANGUAGE_NAMES = {
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  kn: 'Kannada',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ml: 'Malayalam',
  en: 'English',
};

const getGradeStyle = (grade) => {
  if (grade <= 2) {
    return {
      label: 'Grade 1-2',
      style: `You are talking to a 6-7 year old child.
- Use VERY simple words only. Max 2-3 sentences.
- Use lots of emojis 🌱💧🌳
- Compare everything to things kids know (toys, cartoons, home).
- Never use big words. Never use statistics.`,
    };
  }

  if (grade <= 5) {
    return {
      label: 'Grade 3-5',
      style: `You are talking to a 8-10 year old child.
- Use simple sentences. Max 4-5 sentences.
- Use fun comparisons and emojis.
- Give 1-2 easy action tips they can do at home or school.`,
    };
  }

  if (grade <= 8) {
    return {
      label: 'Grade 6-8',
      style: `You are talking to a 11-13 year old student.
- Use clear paragraphs. You can use some data and facts.
- Give practical examples from India.
- 3-5 sentences with 2-3 actionable tips.
- You may mention Indian rivers, cities, and government schemes.`,
    };
  }

  if (grade <= 10) {
    return {
      label: 'Grade 9-10',
      style: `You are talking to a 14-15 year old student.
- Use scientific terms with brief explanations.
- Include India-specific data, policies, and statistics.
- 4-6 sentences and mention real environmental issues.
- Reference laws/projects like Environment Protection Act and Namami Gange.
- Encourage critical thinking.`,
    };
  }

  return {
    label: 'Grade 11-12',
    style: `You are talking to a 16-17 year old student.
- Use advanced scientific and policy language.
- Include global context, India's NDC targets, and IPCC references.
- Reference specific data, percentages, and years where suitable.
- Encourage research pathways and environmental careers.
- You can discuss complex topics such as carbon sequestration, eutrophication, and planetary boundaries.`,
  };
};

const getFallback = (language, grade) => {
  const lang = String(language || 'en').split('-')[0].toLowerCase();
  const gradeNum = Number.parseInt(grade, 10) || 6;

  if (gradeNum <= 2) {
    return {
      en: "I'm resting now! 😴 But remember: turn off taps and plant trees! 🌳💧",
      hi: 'मैं अभी सो रहा हूँ! 😴 पर याद रखो: नल बंद करो और पेड़ लगाओ! 🌳💧',
      bn: 'আমি এখন বিশ্রাম নিচ্ছি! 😴 মনে রেখো: কল বন্ধ করো আর গাছ লাগাও! 🌳💧',
      ta: 'நான் இப்போது ஓய்வெடுக்கிறேன்! 😴 நினைவில் வை: குழாயை மூடு, மரம் நட்டு! 🌳💧',
      te: 'నేను ఇప్పుడే విశ్రాంతి తీసుకుంటున్నా! 😴 కానీ గుర్తుంచుకో: ట్యాప్ మూసి చెట్లు నాటు! 🌳💧',
      mr: 'मी आत्ता विश्रांती घेतोय! 😴 पण लक्षात ठेव: नळ बंद करा आणि झाडे लावा! 🌳💧',
      kn: 'ನಾನು ಈಗ ವಿಶ್ರಾಂತಿ ಪಡೆಯುತ್ತಿದ್ದೇನೆ! 😴 ಆದರೆ ನೆನಪಿಡಿ: ಟ್ಯಾಪ್ ಮುಚ್ಚಿ, ಮರ ನೆಡಿ! 🌳💧',
      gu: 'હું હવે આરામ કરું છું! 😴 પણ યાદ રાખો: નળ બંધ કરો અને વૃક્ષો વાવો! 🌳💧',
      pa: 'ਮੈਂ ਹੁਣ ਅਰਾਮ ਕਰ ਰਿਹਾ ਹਾਂ! 😴 ਪਰ ਯਾਦ ਰੱਖੋ: ਨਲ ਬੰਦ ਕਰੋ ਅਤੇ ਰੁੱਖ ਲਗਾਓ! 🌳💧',
      ml: 'ഞാൻ ഇപ്പോൾ വിശ്രമത്തിലാണ്! 😴 പക്ഷേ ഓർമ്മിക്കുക: ടാപ്പ് ഓഫ് ചെയ്യൂ, മരം നട്ടൂ! 🌳💧',
    }[lang] || "I'm resting now! 😴 Remember to save water and plant a tree today. 🌱";
  }

  if (gradeNum <= 5) {
    return {
      en: "Oops, I'm having trouble connecting! 🤖 Tip: India has 18% of the world's people but only 4% of its freshwater. Save every drop! 💧",
      hi: 'अरे, मुझे जुड़ने में परेशानी हो रही है! 🤖 टिप: भारत में 18% लोग हैं लेकिन मीठा पानी सिर्फ 4% है। हर बूंद बचाओ! 💧',
      bn: 'আহা, সংযোগে একটু সমস্যা হচ্ছে! 🤖 টিপ: বিশ্বের 18% মানুষ ভারতে, কিন্তু মিঠা জল মাত্র 4%! প্রতিটি ফোঁটা বাঁচাও! 💧',
      ta: 'அய்யோ, இணைப்பில் சிக்கல்! 🤖 குறிப்பு: உலக மக்களில் 18% இந்தியாவில், ஆனால் இனி நீர் 4% தான். ஒவ்வொரு துளியையும் சேமிக்கவும்! 💧',
      te: 'అయ్యో, కనెక్షన్ సమస్య ఉంది! 🤖 సూచన: ప్రపంచ జనాభాలో 18% భారతదేశంలో ఉన్నా, తాగునీరు కేవలం 4% మాత్రమే. ప్రతి చుక్కను కాపాడండి! 💧',
      mr: 'अरेरे, कनेक्शनमध्ये अडचण येतेय! 🤖 टिप: जगातील 18% लोक भारतात आहेत, पण गोडे पाणी फक्त 4% आहे. प्रत्येक थेंब वाचवा! 💧',
      kn: 'ಅಯ್ಯೋ, ಸಂಪರ್ಕದಲ್ಲಿ ತೊಂದರೆ ಇದೆ! 🤖 ಸಲಹೆ: ಜಗತ್ತಿನ 18% ಜನರು ಭಾರತದಲ್ಲಿ ಇದ್ದರೂ, ಮಧುರ ನೀರು ಕೇವಲ 4% ಮಾತ್ರ. ಪ್ರತಿಯೊಂದು ಹನಿಯನ್ನೂ ಉಳಿಸಿ! 💧',
      gu: 'અરે, કનેક્શનમાં સમસ્યા છે! 🤖 ટીપ: દુનિયાની 18% વસ્તી ભારતમાં છે, પણ મીઠું પાણી માત્ર 4% છે. દરેક ટીપું બચાવો! 💧',
      pa: 'ਓਹੋ, ਕਨੈਕਸ਼ਨ ਵਿੱਚ ਦਿੱਕਤ ਹੈ! 🤖 ਟਿਪ: ਦੁਨੀਆ ਦੇ 18% ਲੋਕ ਭਾਰਤ ਵਿੱਚ ਹਨ, ਪਰ ਮਿੱਠਾ ਪਾਣੀ ਕੇਵਲ 4% ਹੈ। ਹਰ ਬੂੰਦ ਬਚਾਓ! 💧',
      ml: 'അയ്യോ, കണക്ഷനിൽ പ്രശ്നമുണ്ട്! 🤖 ടിപ്പ്: ലോകത്തിലെ 18% പേർ ഇന്ത്യയിൽ, പക്ഷേ ശുദ്ധജലം 4% മാത്രം. ഓരോ തുള്ളിയും സംരക്ഷിക്കൂ! 💧',
    }[lang] || "I'm having trouble connecting! Tip: save water every day. 💧";
  }

  return {
    en: "I'm having connectivity issues right now. While I reconnect, explore this: India committed to Net Zero by 2070 at COP26. What does that mean for your generation? 🌍",
    hi: 'अभी कनेक्टिविटी में दिक्कत है। इस बीच सोचो: भारत ने COP26 में 2070 तक Net Zero का लक्ष्य रखा। इसका आपकी पीढ़ी के लिए क्या मतलब है? 🌍',
    bn: 'এখন সংযোগে সমস্যা হচ্ছে। এর মধ্যে ভাবো: ভারত COP26-এ 2070 সালের মধ্যে Net Zero লক্ষ্য নিয়েছে। এটা তোমাদের প্রজন্মের জন্য কী বোঝায়? 🌍',
    ta: 'தற்போது இணைப்பு சிக்கல் உள்ளது. இதற்குள் இதை ஆராயுங்கள்: COP26-ல் இந்தியா 2070-க்கு Net Zero இலக்கை அறிவித்தது. அது உங்கள் தலைமுறைக்குப் பொருள் என்ன? 🌍',
    te: 'ఇప్పుడు కనెక్టివిటీ సమస్య ఉంది. ఇంతలో దీన్ని ఆలోచించండి: COP26లో భారత్ 2070 నాటికి Net Zero లక్ష్యం ప్రకటించింది. అది మీ తరం కోసం ఏమని అర్థం? 🌍',
    mr: 'सध्या कनेक्टिव्हिटीमध्ये अडचण आहे. तोपर्यंत हे शोधा: भारताने COP26 मध्ये 2070 पर्यंत Net Zero चे लक्ष्य जाहीर केले. याचा तुमच्या पिढीसाठी काय अर्थ? 🌍',
    kn: 'ಈಗ ಸಂಪರ್ಕ ಸಮಸ್ಯೆಯಿದೆ. ಆಗುವವರೆಗೆ ಇದನ್ನು ಪರಿಶೀಲಿಸಿ: COP26 ನಲ್ಲಿ ಭಾರತ 2070ರೊಳಗೆ Net Zero ಗುರಿ ಘೋಷಿಸಿದೆ. ಅದು ನಿಮ್ಮ ಪೀಳಿಗೆಗೆ ಏನು ಅರ್ಥ? 🌍',
    gu: 'હાલ કનેક્ટિવિટી સમસ્યા છે. ત્યાં સુધી આ વિચારો: COP26માં ભારતે 2070 સુધી Net Zero લક્ષ્ય જાહેર કર્યું. તેનો તમારી પેઢી માટે શું અર્થ છે? 🌍',
    pa: 'ਇਸ ਵੇਲੇ ਕਨੈਕਟਿਵਿਟੀ ਦੀ ਸਮੱਸਿਆ ਹੈ। ਇਸ ਦੌਰਾਨ ਇਹ ਸੋਚੋ: COP26 ਵਿੱਚ ਭਾਰਤ ਨੇ 2070 ਤੱਕ Net Zero ਦਾ ਲਕਸ਼ ਰੱਖਿਆ। ਇਸਦਾ ਤੁਹਾਡੀ ਪੀੜ੍ਹੀ ਲਈ ਕੀ ਮਤਲਬ ਹੈ? 🌍',
    ml: 'ഇപ്പോൾ കണക്റ്റിവിറ്റി പ്രശ്നമുണ്ട്. അതുവരെ ഇത് പഠിക്കൂ: COP26-ൽ ഇന്ത്യ 2070ഓടെ Net Zero ലക്ഷ്യം പ്രഖ്യാപിച്ചു. അത് നിങ്ങളുടെ തലമുറയ്ക്ക് എന്താണ് സൂചിപ്പിക്കുന്നത്? 🌍',
  }[lang] || 'Connectivity issue! Explore India\'s Net Zero 2070 commitment and its implications. 🌍';
};

const buildSystemPrompt = (language, grade) => {
  const normalizedLanguage = String(language || 'en').split('-')[0].toLowerCase();
  const gradeNum = Number.parseInt(grade, 10) || 6;
  const gradeStyle = getGradeStyle(gradeNum);
  const languageName = LANGUAGE_NAMES[normalizedLanguage] || 'English';

  return `You are EcoBot, a friendly environmental education assistant for Indian school children.
You are currently speaking with a ${gradeStyle.label} student.

${gradeStyle.style}

Always respond in ${languageName} language only.
Keep responses fun, encouraging, and India-relevant.
Never give scary or negative information without a positive action tip.
End every response with one simple action the student can take today. 🌱`;
};

async function collectReplyFromStream(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let reply = '';

    stream.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;

        const payload = line.replace(/^data:\s*/, '');
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          const full = parsed?.choices?.[0]?.message?.content;
          if (typeof delta === 'string') reply += delta;
          else if (typeof full === 'string') reply += full;
        } catch {
          // Ignore non-JSON stream frames
        }
      }
    });

    stream.on('end', () => resolve(reply.trim()));
    stream.on('error', reject);
  });
}

exports.chat = async (req, res) => {
  const { message, language = 'en', grade = '6' } = req.body;
  const normalizedLanguage = String(language || 'en').split('-')[0].toLowerCase();
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const headers = {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      Accept: STREAM ? 'text/event-stream' : 'application/json',
      'Content-Type': 'application/json'
    };

    const fullPrompt = buildSystemPrompt(normalizedLanguage, grade);

    const payload = {
      model: 'meta/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 150,
      temperature: 0.55,
      top_p: 0.95,
      stream: STREAM
    };

    const response = await axios.post(INVOKE_URL, payload, {
      headers,
      responseType: STREAM ? 'stream' : 'json',
      timeout: 8000
    });

    const reply = STREAM
      ? await collectReplyFromStream(response.data)
      : response?.data?.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('Empty response from NVIDIA API');
    }

    return res.json({ reply });

  } catch (error) {
    console.error('EcoBot API error:', error.message);
    const fallback = getFallback(normalizedLanguage, grade);
    return res.json({ reply: fallback, fallback: true });
  }
};

// Backward-compatible exports for existing routes
exports.postMessage = exports.chat;
exports.getHistory = async (req, res) => res.json({ success: true, data: { messages: [], count: 0 } });
exports.clearHistory = async (req, res) => res.json({ success: true, message: 'Chat history cleared' });
