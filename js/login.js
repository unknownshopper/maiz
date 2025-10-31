// js/login.js
document.addEventListener('DOMContentLoaded', () => {
    window.firebaseApp.init();

    // Manejar submit del formulario
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('loginBtn');
        const errorMsg = document.getElementById('errorMessage');

        console.log('🔐 Intentando login con:', email);

        // Deshabilitar botón
        btn.disabled = true;
        btn.textContent = 'Iniciando sesión...';
        errorMsg.classList.add('hidden');

        // Intentar login
        const result = await window.authManager.login(email, password);
        
        console.log('📊 Resultado del login:', result);

        if (result.success) {
            console.log('✅ Login exitoso, rol:', result.role);
            // Redirigir según el rol del usuario
            const role = result.role;
            const defaultRoutes = {
                admin: 'resultados.html',
                supervisor: 'resultados.html',
                encuestador: 'encuesta.html'
            };
            const redirectUrl = defaultRoutes[role] || 'encuesta.html';
            console.log('🔄 Redirigiendo a:', redirectUrl);
            window.location.href = redirectUrl;
        } else {
            console.error('❌ Error en login:', result.error);
            errorMsg.textContent = '❌ ' + result.error;
            errorMsg.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Iniciar Sesión';
        }
    });
});