require('dotenv').config();
const axios = require('axios');

console.log('🔍 Probando clave Gemini...');
console.log('Clave:', process.env.GEMINI_API_KEY ? '✅ Presente' : '❌ Faltante');

if (!process.env.GEMINI_API_KEY) {
    console.log('❌ ERROR: No hay clave GEMINI_API_KEY en .env');
    process.exit(1);
}

console.log('🌐 Probando conexión con Gemini...');

axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`)
    .then(response => {
        console.log('✅ Conexión exitosa con Gemini API');
        console.log('Modelos disponibles:', response.data.models ? response.data.models.length : 0);
    })
    .catch(error => {
        console.log('❌ Error de conexión:');
        console.log('• Mensaje:', error.message);
        console.log('• Código:', error.code);
        console.log('• Status:', error.response?.status);
        console.log('🔧 Verifica:');
        console.log('1. Que la clave API sea correcta');
        console.log('2. Que la API Generative Language esté habilitada');
        console.log('3. Que la clave tenga permisos suficientes');
    });