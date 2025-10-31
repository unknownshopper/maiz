// js/permissions.js
class PermissionsManager {
    constructor() {
        this.roles = {
            admin: {
                name: 'Administrador',
                permissions: {
                    surveys: {
                        create: true,
                        read: true,
                        update: true,
                        delete: true,
                        export: true
                    },
                    users: {
                        create: true,
                        read: true,
                        update: true,
                        delete: true
                    },
                    analytics: {
                        view: true,
                        export: true
                    }
                },
                routes: ['encuesta.html', 'listae.html', 'resultados.html']
            },
            supervisor: {
                name: 'Supervisor',
                permissions: {
                    surveys: {
                        create: false,
                        read: true,
                        update: false,
                        delete: false,
                        export: true
                    },
                    users: {
                        create: false,
                        read: true,
                        update: false,
                        delete: false
                    },
                    analytics: {
                        view: true,
                        export: true
                    }
                },
                routes: ['encuesta.html', 'listae.html', 'resultados.html']  // Agregar encuesta.html
            },
            encuestador: {
                name: 'Encuestador',
                permissions: {
                    surveys: {
                        create: true,
                        read: true,
                        update: false,
                        delete: false,
                        export: false
                    },
                    users: {
                        create: false,
                        read: false,
                        update: false,
                        delete: false
                    },
                    analytics: {
                        view: false,
                        export: false
                    }
                },
                routes: ['encuesta.html', 'listae.html']
            }
        };
    }

    // Verificar si el usuario tiene un permiso específico
    can(action, resource) {
        const role = window.authManager.getCurrentRole();
        if (!role || !this.roles[role]) {
            return false;
        }

        const permissions = this.roles[role].permissions[resource];
        if (!permissions) {
            return false;
        }

        return permissions[action] === true;
    }

    // Verificar si el usuario puede acceder a una ruta
    canAccessRoute(route) {
        const role = window.authManager.getCurrentRole();
        if (!role || !this.roles[role]) {
            return false;
        }

        const allowedRoutes = this.roles[role].routes;
        const currentPage = route.split('/').pop();
        
        return allowedRoutes.includes(currentPage);
    }

    // Obtener nombre del rol
    getRoleName(role) {
        return this.roles[role]?.name || 'Desconocido';
    }

    // Verificar acceso y redirigir si no tiene permiso
    checkRouteAccess() {
        const currentPage = window.location.pathname.split('/').pop();
        
        // Páginas públicas
        if (currentPage === 'index.html' || currentPage === '') {
            return true;
        }

        // Verificar autenticación
        if (!window.authManager.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }

        // Verificar permisos de ruta
        if (!this.canAccessRoute(currentPage)) {
            this.redirectToDefaultRoute();
            return false;
        }

        return true;
    }

    // Redirigir a la ruta por defecto según el rol
    redirectToDefaultRoute() {
        const role = window.authManager.getCurrentRole();
        const defaultRoutes = {
            admin: 'resultados.html',
            supervisor: 'resultados.html',
            encuestador: 'encuesta.html'
        };

        window.location.href = defaultRoutes[role] || 'index.html';
    }

    // Ocultar elementos del DOM según permisos
    applyUIPermissions() {
        const role = window.authManager.getCurrentRole();
        
        // Ocultar botones de crear si no tiene permiso
        if (!this.can('create', 'surveys')) {
            document.querySelectorAll('[data-permission="create-survey"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Ocultar botones de eliminar si no tiene permiso
        if (!this.can('delete', 'surveys')) {
            document.querySelectorAll('[data-permission="delete-survey"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Ocultar botones de editar si no tiene permiso
        if (!this.can('update', 'surveys')) {
            document.querySelectorAll('[data-permission="update-survey"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Ocultar exportar si no tiene permiso
        if (!this.can('export', 'surveys')) {
            document.querySelectorAll('[data-permission="export-survey"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Mostrar rol del usuario
        document.querySelectorAll('[data-role-name]').forEach(el => {
            el.textContent = this.getRoleName(role);
        });
    }
}

window.permissionsManager = new PermissionsManager();