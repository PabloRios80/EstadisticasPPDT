require('dotenv').config();
const axios = require('axios');

async function listModels() {
    try {
        console.log('📋 Listando modelos disponibles...');
        
        const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('✅ Modelos disponibles:');
        response.data.models.forEach(model => {
            console.log(`- ${model.name}`);
            console.log(`  Supported methods: ${model.supportedGenerationMethods?.join(', ') || 'Ninguno'}`);
            console.log('---');
        });
        
    } catch (error) {
        console.log('❌ Error al listar modelos:');
        console.log('Status:', error.response?.status);
        console.log('Data:', error.response?.data);
    }
}

listModels();