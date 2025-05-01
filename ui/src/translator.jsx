import axios from 'axios';

export const translateText = async (text, targetLang) => {
  const url = 'https://libretranslate.de/translate'; // URL of LibreTranslate API

  try {
    const response = await axios.post(url, {
      q: text,
      source: 'auto',  // Automatically detect the language
      target: targetLang,
      format: 'text'
    });

    const translatedText = response.data.translatedText;
    return translatedText;
  } catch (error) {
    console.error("Error during translation:", error);
    return text;  // If translation fails, return the original text
  }
};
