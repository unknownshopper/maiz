// js/firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyACNmIjI9Zi9BoHfmbd7-i2jJiNtCbL0Jk",
    authDomain: "maiz-f04ae.firebaseapp.com",
    projectId: "maiz-f04ae",
    storageBucket: "maiz-f04ae.firebasestorage.app",
    messagingSenderId: "346363174673",
    appId: "1:346363174673:web:9845de18293b734f1236b0"
};

// MODO DE PRUEBA - Cambiar a false cuando quieras usar Firebase real
const TEST_MODE = false;

let app, auth, db;

function initFirebase() {
    if (TEST_MODE) {
        console.warn('⚠️ MODO DE PRUEBA ACTIVADO - Usando datos simulados');
        window.mockUser = {
            uid: 'test-user-123',
            email: 'test@test.com'
        };
        return;
    }
    
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log('✅ Firebase inicializado correctamente');
    }
}

window.firebaseApp = {
    init: initFirebase,
    getAuth: () => auth,
    getDb: () => db,
    isTestMode: () => TEST_MODE
};