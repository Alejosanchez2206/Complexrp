// helpers.js
const generarId = () => {
    const timestamp = Date.now().toString();
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const numeros = timestamp.slice(-5); // Obtiene los últimos 5 dígitos del timestamp
    const generarLetra = () => letras[Math.floor(Math.random() * letras.length)];
    const id = Array(5).fill(null).map(generarLetra).join('') + numeros;
    return id;
};

module.exports = { generarId };  // Exporta la función
