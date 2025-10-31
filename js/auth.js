// js/auth.js
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        
        // Restaurar sesión de prueba si existe
        if (window.firebaseApp && window.firebaseApp.isTestMode && window.firebaseApp.isTestMode()) {
            const savedUser = localStorage.getItem('testUser');
            const savedRole = localStorage.getItem('testRole');
            if (savedUser && savedRole) {
                this.currentUser = JSON.parse(savedUser);
                this.userRole = savedRole;
            }
        }
    }

    async login(email, password) {
        try {
            if (window.firebaseApp.isTestMode()) {
                // Usuarios de prueba
                const testUsers = {
                    'test@test.com': { password: 'test123', role: 'admin' },
                    'test2@test.com': { password: 'test123', role: 'supervisor' },
                    'test3@test.com': { password: 'test123', role: 'encuestador' }
                };
                
                const testUser = testUsers[email];
                
                if (testUser && password === testUser.password) {
                    this.currentUser = {
                        uid: 'test-user-' + email.split('@')[0],
                        email: email
                    };
                    this.userRole = testUser.role;
                    
                    // Guardar en localStorage para persistencia
                    localStorage.setItem('testUser', JSON.stringify(this.currentUser));
                    localStorage.setItem('testRole', this.userRole);
                    
                    return {
                        success: true,
                        user: this.currentUser,
                        role: this.userRole
                    };
                } else {
                    return {
                        success: false,
                        error: 'Credenciales incorrectas. Usuarios de prueba:\n• test@test.com / test123 (Admin)\n• test2@test.com / test123 (Supervisor)\n• test3@test.com / test123 (Encuestador)'
                    };
                }
            }
            
            // Firebase real
            const auth = window.firebaseApp.getAuth();
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            this.currentUser = userCredential.user;
            await this.loadUserRole();
            
            return {
                success: true,
                user: this.currentUser,
                role: this.userRole
            };
        } catch (error) {
            console.error('Error en login:', error);
            let errorMessage = 'Error al iniciar sesión';
            
            // Mensajes de error más amigables
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Usuario no encontrado';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Contraseña incorrecta';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email inválido';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Demasiados intentos. Intenta más tarde';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    async loadUserRole() {
        try {
            if (window.firebaseApp.isTestMode()) {
                this.userRole = this.userRole || 'encuestador';
                return;
            }
            
            const db = window.firebaseApp.getDb();
            console.log('🔍 Buscando rol para UID:', this.currentUser.uid);
            
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            
            console.log('📄 Documento existe:', userDoc.exists);
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('📋 Datos del usuario:', userData);
                this.userRole = userData.role || 'encuestador';
                console.log('👤 Rol asignado:', this.userRole);
            } else {
                console.warn('⚠️ No se encontró documento para el usuario');
                this.userRole = 'encuestador';
            }
        } catch (error) {
            console.error('❌ Error cargando rol:', error);
            this.userRole = 'encuestador';
        }
    }

    
    async logout() {
        try {
            if (window.firebaseApp.isTestMode()) {
                this.currentUser = null;
                this.userRole = null;
                localStorage.removeItem('testUser');
                localStorage.removeItem('testRole');
                return { success: true };
            }
            
            const auth = window.firebaseApp.getAuth();
            await auth.signOut();
            this.currentUser = null;
            this.userRole = null;
            return { success: true };
        } catch (error) {
            console.error('Error en logout:', error);
            return { success: false, error: error.message };
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    hasRole(role) {
        return this.userRole === role;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentRole() {
        return this.userRole;
    }

    onAuthStateChanged(callback) {
        if (window.firebaseApp.isTestMode()) {
            setTimeout(() => {
                callback(this.currentUser, this.userRole);
            }, 100);
            return;
        }
        
        const auth = window.firebaseApp.getAuth();
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                await this.loadUserRole();
            } else {
                this.userRole = null;
            }
            callback(user, this.userRole);
        });
    }
}   
window.authManager = new AuthManager();
