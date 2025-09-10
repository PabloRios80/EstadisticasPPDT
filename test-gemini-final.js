require('dotenv').config();
const axios = require('axios');

async function testGemini() {
    try {
        console.log('🧪 Probando generación de contenido...');
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: "Genera un párrafo breve sobre salud preventiva"
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 500
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('✅ ÉXITO: Gemini respondió correctamente');
        console.log('Respuesta:', response.data.candidates[0].content.parts[0].text);
        
    } catch (error) {
        console.log('❌ ERROR:');
        console.log('Status:', error.response?.status);
        console.log('Data:', error.response?.data);
        console.log('Message:', error.message);
    }
}

testGemini();