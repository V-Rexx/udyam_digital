import { LOCALES, CITY_ORDER, CITY_HI, SETUP } from './locales.js';

export const QUESTIONS = {
  businessType: {
    en: 'What kind of business do you run? For example a kirana store, clinic or CA firm.',
    hi: 'आपका कारोबार किस तरह का है? जैसे किराना दुकान, क्लिनिक या CA फर्म।',
    mr: 'तुमचा व्यवसाय कोणता आहे? उदा. किराणा दुकान, क्लिनिक किंवा CA फर्म.',
  },
  currentSetup: { en: 'How does your business get online today?', hi: 'अभी आपका कारोबार इंटरनेट कैसे चलाता है?', mr: 'सध्या तुमचा व्यवसाय इंटरनेट कसा वापरतो?' },
  city: { en: 'Which city is your business in?', hi: 'आपका कारोबार किस शहर में है?', mr: 'तुमचा व्यवसाय कोणत्या शहरात आहे?' },
  employees: { en: 'How many people work there, including you?', hi: 'आपको मिलाकर वहाँ कितने लोग काम करते हैं?', mr: 'तुमच्यासह तिथे किती लोक काम करतात?' },
  sites: { en: 'How many locations do you have?', hi: 'आपकी कितनी जगहों पर दुकान या ऑफिस हैं?', mr: 'तुमची किती ठिकाणी दुकाने किंवा कार्यालये आहेत?' },
  gstin: {
    en: 'Does your business have a GST registration? Some products need one, so this keeps the advice accurate.',
    hi: 'क्या आपके कारोबार का GST रजिस्ट्रेशन है? कुछ प्रोडक्ट के लिए यह ज़रूरी है।',
    mr: 'तुमच्या व्यवसायाची GST नोंदणी आहे का? काही उत्पादनांसाठी ती आवश्यक असते.',
  },
  fibre: {
    en: 'Is fibre broadband available at your premises?',
    hi: 'क्या आपकी जगह पर फाइबर ब्रॉडबैंड उपलब्ध है?',
    mr: 'तुमच्या जागेवर फायबर ब्रॉडबँड उपलब्ध आहे का?',
  },
  needs: { en: 'What do you want this to help with? Pick all that apply.', hi: 'आपको किन चीज़ों में मदद चाहिए? जो लागू हों, सब चुनें।', mr: 'तुम्हाला कशासाठी मदत हवी आहे? लागू असतील ते सर्व निवडा.' },
};

const c = (value, en, hi, mr) => ({ value, label: { en, hi: hi ?? en, mr: mr ?? hi ?? en } });

export const CHIPS = {
  businessType: {
    micro: [c('Kirana store', 'Kirana store', 'किराना दुकान', 'किराणा दुकान'), c('Salon', 'Salon', 'सैलून', 'सलून'), c('Pharmacy', 'Pharmacy', 'फार्मेसी', 'औषध दुकान')],
    prof: [c('Dental clinic', 'Clinic', 'क्लिनिक', 'क्लिनिक'), c('CA firm', 'CA firm', 'CA फर्म', 'CA फर्म'), c('Coaching centre', 'Coaching centre', 'कोचिंग सेंटर', 'कोचिंग क्लास')],
    multi: [c('Restaurant chain', 'Restaurant chain', 'रेस्टोरेंट चेन', 'रेस्टॉरंट चेन')],
    mfg: [c('Auto-parts unit', 'Manufacturing unit', 'मैन्युफैक्चरिंग यूनिट', 'उत्पादन युनिट')],
  },
  currentSetup: [
    c('hotspot', 'Mobile hotspot', 'मोबाइल हॉटस्पॉट', 'मोबाइल हॉटस्पॉट'), c('home', 'Home broadband', 'घर का ब्रॉडबैंड', 'घरचे ब्रॉडबँड'),
    c('business', 'Business broadband', 'बिज़नेस ब्रॉडबैंड', 'बिझनेस ब्रॉडबँड'), c('leased', 'Leased line', 'लीज़्ड लाइन', 'लीज्ड लाइन'),
    c('mixed', 'Different at each site', 'हर जगह अलग', 'प्रत्येक ठिकाणी वेगळे'),
  ],
  yesNoUnsure: {
    gstin: [c('yes', 'Yes', 'हाँ', 'होय'), c('no', 'No', 'नहीं', 'नाही')],
    fibre: [c('yes', 'Yes', 'हाँ', 'होय'), c('no', 'No', 'नहीं', 'नाही'), c('unsure', 'Not sure', 'पता नहीं', 'माहीत नाही')],
  },
  needs: {
    payments: c('payments', 'Billing and UPI', 'बिलिंग और UPI', 'बिलिंग आणि UPI'),
    whatsapp: c('whatsapp', 'WhatsApp for customers', 'ग्राहकों के लिए WhatsApp', 'ग्राहकांसाठी WhatsApp'),
    sms: c('sms', 'SMS alerts', 'SMS अलर्ट', 'SMS सूचना'),
    website: c('website', 'A website', 'वेबसाइट', 'वेबसाइट'),
    cctv: c('cctv', 'CCTV', 'CCTV', 'CCTV'),
    wifi: c('wifi', 'Customer Wi-Fi', 'ग्राहकों के लिए Wi-Fi', 'ग्राहकांसाठी Wi-Fi'),
    email: c('email', 'Business email', 'बिज़नेस ईमेल', 'बिझनेस ईमेल'),
    backup: c('backup', 'Data backup', 'डेटा बैकअप', 'डेटा बॅकअप'),
    security: c('security', 'Virus protection', 'वायरस से सुरक्षा', 'व्हायरसपासून सुरक्षा'),
    firewall: c('firewall', 'Network firewall', 'नेटवर्क फ़ायरवॉल', 'नेटवर्क फायरवॉल'),
    failover: c('failover', 'Backup internet', 'बैकअप इंटरनेट', 'बॅकअप इंटरनेट'),
    telephony: c('telephony', 'Business phone lines', 'बिज़नेस फ़ोन लाइन', 'बिझनेस फोन लाइन'),
    tollfree: c('tollfree', 'Toll-free number', 'टोल-फ्री नंबर', 'टोल-फ्री नंबर'),
    central: c('central', 'Manage all sites centrally', 'सभी जगहों का एक जगह से प्रबंधन', 'सर्व ठिकाणे एकाच जागेवरून'),
    fleet: c('fleet', 'Vehicle tracking', 'गाड़ी ट्रैकिंग', 'वाहन ट्रॅकिंग'),
    machines: c('machines', 'Machine monitoring', 'मशीन मॉनिटरिंग', 'मशीन मॉनिटरिंग'),
    dedicated: c('dedicated', 'Dedicated bandwidth', 'डेडिकेटेड इंटरनेट', 'डेडिकेटेड इंटरनेट'),
    mobile: c('mobile', 'Just mobile plans', 'सिर्फ़ मोबाइल प्लान', 'फक्त मोबाइल प्लॅन'),
    unsure: c('unsure', 'Not sure, suggest for me', 'पता नहीं, आप बताइए', 'माहीत नाही, तुम्हीच सुचवा'),
  },
};

export const NEEDS_BY_SEGMENT = {
  micro: ['payments', 'whatsapp', 'website', 'cctv', 'wifi', 'sms', 'mobile', 'unsure'],
  prof: ['email', 'security', 'backup', 'failover', 'telephony', 'whatsapp', 'website', 'firewall', 'mobile', 'unsure'],
  multi: ['central', 'cctv', 'failover', 'email', 'payments', 'security', 'tollfree', 'fleet', 'firewall', 'unsure'],
  mfg: ['dedicated', 'machines', 'firewall', 'email', 'security', 'backup', 'fleet', 'cctv', 'unsure'],
};

const r = (en, hi, mr) => ({ en, hi: hi ?? en, mr: mr ?? hi ?? en });

export const REASONS = {
  'line:micro': r('Steady internet so UPI and billing keep working when the hotspot drops.', 'स्थिर इंटरनेट, ताकि हॉटस्पॉट बंद होने पर भी UPI और बिलिंग चलती रहे।', 'स्थिर इंटरनेट, ज्यामुळे हॉटस्पॉट बंद पडला तरी UPI आणि बिलिंग सुरू राहते.'),
  'line:prof': r('Reliable internet for your team and your software.', 'आपकी टीम और सॉफ़्टवेयर के लिए भरोसेमंद इंटरनेट।', 'तुमच्या टीमसाठी आणि सॉफ्टवेअरसाठी विश्वासार्ह इंटरनेट.'),
  'line:multi': r('The same line at every location, on one bill.', 'हर जगह एक जैसी लाइन, एक ही बिल पर।', 'प्रत्येक ठिकाणी एकच लाइन, एकाच बिलावर.'),
  'line:mfg': r('Dedicated capacity so machines and ERP stay connected.', 'डेडिकेटेड इंटरनेट, ताकि मशीनें और ERP जुड़े रहें।', 'डेडिकेटेड इंटरनेट, ज्यामुळे मशीन आणि ERP जोडलेले राहतात.'),
  mobile: r('Business mobile lines on the same bill.', 'एक ही बिल पर बिज़नेस मोबाइल लाइनें।', 'एकाच बिलावर बिझनेस मोबाइल लाइन.'),
  requested: r('You asked for this.', 'आपने यह माँगा था।', 'तुम्ही हे मागितले होते.'),
  added_by_owner: r('You added this.', 'आपने यह जोड़ा।', 'तुम्ही हे जोडले.'),
  'need:payments': r('GST billing, stock and UPI or card payments on one tablet.', 'एक ही टैबलेट पर GST बिलिंग, स्टॉक और UPI या कार्ड पेमेंट।', 'एकाच टॅबलेटवर GST बिलिंग, स्टॉक आणि UPI किंवा कार्ड पेमेंट.'),
  'need:whatsapp': r('A verified WhatsApp channel with your catalogue.', 'आपके कैटलॉग के साथ वेरिफ़ाइड WhatsApp चैनल।', 'तुमच्या कॅटलॉगसह व्हेरिफाइड WhatsApp चॅनल.'),
  'need:sms': r('Alerts and offers to your customers by SMS.', 'ग्राहकों को SMS से अलर्ट और ऑफ़र।', 'ग्राहकांना SMS द्वारे सूचना आणि ऑफर.'),
  'need:website': r('A simple website on your own domain.', 'अपने डोमेन पर एक आसान वेबसाइट।', 'स्वतःच्या डोमेनवर सोपी वेबसाइट.'),
  'need:cctv': r('Cameras you can watch from your phone, with 30 days of recording.', 'कैमरे जिन्हें फ़ोन पर देख सकें, 30 दिन की रिकॉर्डिंग के साथ।', 'फोनवर पाहता येणारे कॅमेरे, 30 दिवसांच्या रेकॉर्डिंगसह.'),
  'need:email': r('Email on your own domain instead of personal Gmail.', 'निजी Gmail की जगह अपने डोमेन पर ईमेल।', 'वैयक्तिक Gmail ऐवजी स्वतःच्या डोमेनवर ईमेल.'),
  'need:backup': r('Automatic backup, so a lost laptop does not mean lost records.', 'अपने आप बैकअप, ताकि लैपटॉप खोने पर रिकॉर्ड न खोएँ।', 'आपोआप बॅकअप, ज्यामुळे लॅपटॉप हरवला तरी नोंदी राहतात.'),
  'need:security': r('Protection against viruses and ransomware on every device.', 'हर डिवाइस पर वायरस और रैनसमवेयर से सुरक्षा।', 'प्रत्येक डिव्हाइसवर व्हायरस आणि रॅन्समवेअरपासून सुरक्षा.'),
  'need:firewall': r('A firewall at your site, managed for you.', 'आपकी जगह पर फ़ायरवॉल, जिसे हम सँभालते हैं।', 'तुमच्या जागेवर फायरवॉल, जो आम्ही सांभाळतो.'),
  'need:wifi': r('Separate Wi-Fi for customers, so your billing stays private.', 'ग्राहकों के लिए अलग Wi-Fi, ताकि आपकी बिलिंग सुरक्षित रहे।', 'ग्राहकांसाठी वेगळे Wi-Fi, ज्यामुळे तुमचे बिलिंग सुरक्षित राहते.'),
  'need:failover': r('Switches to mobile data on its own when the main line goes down.', 'मुख्य लाइन बंद होने पर अपने आप मोबाइल डेटा पर चला जाता है।', 'मुख्य लाइन बंद पडल्यावर आपोआप मोबाइल डेटावर जाते.'),
  'need:telephony': r('Office phone lines with call routing and recording.', 'कॉल रूटिंग और रिकॉर्डिंग के साथ ऑफ़िस फ़ोन लाइनें।', 'कॉल राउटिंग आणि रेकॉर्डिंगसह ऑफिस फोन लाइन.'),
  'need:tollfree': r('An 1800 number customers can call for free.', '1800 नंबर, जिस पर ग्राहक मुफ़्त कॉल कर सकें।', '1800 नंबर, ज्यावर ग्राहक मोफत कॉल करू शकतात.'),
  'need:staticip': r('A fixed address for remote access to your systems.', 'सिस्टम तक रिमोट एक्सेस के लिए स्थिर IP।', 'रिमोट ॲक्सेससाठी स्थिर IP.'),
  'need:central': r('Run all your locations from one screen.', 'सभी जगहों को एक स्क्रीन से चलाइए।', 'सर्व ठिकाणे एकाच स्क्रीनवरून चालवा.'),
  'need:fleet': r('Live location of your vehicles.', 'आपकी गाड़ियों की लाइव लोकेशन।', 'तुमच्या वाहनांचे लाइव्ह लोकेशन.'),
  'need:machines': r('See machine uptime and energy use.', 'मशीन का चलना और बिजली की खपत देखिए।', 'मशीनचे चालू राहणे आणि वीज वापर पाहा.'),
  dependency: r('Needed for something else in your bundle.', 'आपके बंडल की दूसरी चीज़ के लिए ज़रूरी है।', 'तुमच्या बंडलमधील दुसऱ्या गोष्टीसाठी आवश्यक.'),
};

export const LOCKED = {
  tier: r('Sold only in larger cities for now.', 'अभी सिर्फ़ बड़े शहरों में उपलब्ध है।', 'सध्या फक्त मोठ्या शहरांत उपलब्ध.'),
  employees: r('Needs at least {need} people at the business.', 'इसके लिए कम से कम {need} लोग होने चाहिए।', 'यासाठी किमान {need} लोक असायला हवेत.'),
  sites: r('Needs at least {need} locations.', 'इसके लिए कम से कम {need} जगहें होनी चाहिए।', 'यासाठी किमान {need} ठिकाणे हवीत.'),
  gstin: r('Needs an active GST registration.', 'इसके लिए सक्रिय GST रजिस्ट्रेशन ज़रूरी है।', 'यासाठी सक्रिय GST नोंदणी आवश्यक आहे.'),
  dependency: r('Needs a line this business cannot get here.', 'इसके लिए ऐसी लाइन चाहिए जो यहाँ उपलब्ध नहीं है।', 'यासाठी लागणारी लाइन इथे उपलब्ध नाही.'),
};

export const TEXT = {
  bundleReady: r('Here is what I suggest for your {type}, at one monthly price of ₹{monthly} plus GST.', 'आपके {type} के लिए मेरा सुझाव यह है, एक मासिक कीमत ₹{monthly} + GST।', 'तुमच्या {type} साठी माझी सूचना ही आहे, एक मासिक किंमत ₹{monthly} + GST.'),
  notInCatalogue: r('I can only recommend what is in the Accel Business catalogue, so I cannot offer that.', 'मैं सिर्फ़ Accel Business कैटलॉग की चीज़ें सुझा सकता हूँ, इसलिए वह नहीं दे सकता।', 'मी फक्त Accel Business कॅटलॉगमधील गोष्टी सुचवू शकतो, त्यामुळे ते देऊ शकत नाही.'),
  noDiscount: r('Prices are fixed within the catalogue, so I cannot change them. I can remove add-ons to bring the total down. Tell me a monthly budget and I will fit the bundle to it.', 'कीमतें कैटलॉग से तय हैं, मैं उन्हें बदल नहीं सकता। ऐड-ऑन हटाकर कुल कीमत कम कर सकता हूँ। अपना मासिक बजट बताइए।', 'किमती कॅटलॉगनुसार ठरलेल्या आहेत, मी त्या बदलू शकत नाही. ॲड-ऑन काढून एकूण किंमत कमी करू शकतो. तुमचे मासिक बजेट सांगा.'),
  handoff: {
    asked_for_person: r('I have asked a person to call you. Your answers are saved, so you will not need to repeat them.', 'मैंने एक व्यक्ति को आपको कॉल करने के लिए कहा है। आपके जवाब सेव हैं, दोहराने की ज़रूरत नहीं।', 'मी एका व्यक्तीला तुम्हाला कॉल करायला सांगितले आहे. तुमची उत्तरे जतन आहेत.'),
    city_not_served: r('We do not sell in {city} yet. I have saved your details and our team will contact you when we do.', 'अभी हम {city} में उपलब्ध नहीं हैं। आपकी जानकारी सेव है, उपलब्ध होने पर हमारी टीम संपर्क करेगी।', 'आम्ही अजून {city} मध्ये उपलब्ध नाही. तुमची माहिती जतन आहे, उपलब्ध झाल्यावर आमची टीम संपर्क करेल.'),
    beyond_smb_size: r('A business your size is best served by our enterprise team, so I have asked them to call you.', 'आपके आकार के कारोबार के लिए हमारी एंटरप्राइज़ टीम बेहतर रहेगी। उन्हें कॉल करने को कहा है।', 'तुमच्या आकाराच्या व्यवसायासाठी आमची एंटरप्राइझ टीम योग्य आहे. त्यांना कॉल करायला सांगितले आहे.'),
    leased_line_survey: r('A dedicated line needs a site survey first, so an engineer will call you to arrange one. Your quote stays saved.', 'डेडिकेटेड लाइन के लिए पहले साइट सर्वे ज़रूरी है। इंजीनियर कॉल करेंगे। आपका कोट सेव है।', 'डेडिकेटेड लाइनसाठी आधी साइट सर्व्हे आवश्यक आहे. इंजिनिअर कॉल करतील. तुमचा कोट जतन आहे.'),
  },
};

for (const [lang, L] of Object.entries(LOCALES)) {
  for (const k of Object.keys(QUESTIONS)) QUESTIONS[k][lang] = k === 'currentSetup' ? SETUP[lang].q : L.questions[k];
  for (const c of CHIPS.currentSetup) c.label[lang] = SETUP[lang][c.value];
  for (const c of Object.values(CHIPS.businessType).flat()) c.label[lang] = L.business[c.value];
  for (const group of Object.values(CHIPS.yesNoUnsure)) for (const c of group) c.label[lang] = L.yesNo[c.value];
  for (const [k, c] of Object.entries(CHIPS.needs)) c.label[lang] = L.needs[k];
  for (const k of Object.keys(REASONS)) REASONS[k][lang] = L.reasons[k];
  for (const k of Object.keys(LOCKED)) LOCKED[k][lang] = L.locked[k];
  for (const k of ['bundleReady', 'notInCatalogue', 'noDiscount']) TEXT[k][lang] = L.text[k];
  for (const k of Object.keys(TEXT.handoff)) TEXT.handoff[k][lang] = L.handoff[k];
}

const CITY_NAMES = { hi: CITY_HI, mr: CITY_HI, ...Object.fromEntries(Object.entries(LOCALES).map(([l, v]) => [l, v.cities])) };

export const cityLabel = (city, lang) => CITY_NAMES[lang]?.[CITY_ORDER.indexOf(city)] ?? city;

export function cityFromLocalName(text) {
  const t = String(text ?? '');
  for (const names of Object.values(CITY_NAMES)) {
    const i = names.findIndex((n) => t.includes(n));
    if (i >= 0) return CITY_ORDER[i];
  }
  return null;
}

export const say = (entry, lang, params = {}) => {
  const text = entry?.[lang] ?? entry?.en ?? '';
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
};
