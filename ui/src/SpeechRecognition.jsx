// src/hooks/useSpeechRecognition.js
const useSpeechRecognition = (onResult, lang = 'en-IN') => {
    const recognitionRef = useRef(null);
  
    useEffect(() => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
      if (!SpeechRecognition) {
        console.error('Speech Recognition not supported');
        return;
      }
  
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = false;
  
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };
  
      recognition.onerror = (e) => {
        console.error('Speech Recognition error', e);
      };
  
      recognitionRef.current = recognition;
    }, [lang, onResult]);
  
    const start = () => recognitionRef.current?.start();
    const stop = () => recognitionRef.current?.stop();
  
    return { start, stop };
  };
  
  export default useSpeechRecognition;
  