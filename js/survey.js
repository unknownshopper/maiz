// js/survey.js
// Gestión de encuestas con cadena de custodia
class SurveyManager {
    constructor() {
        this.currentLocation = null;
        this.deviceInfo = this.getDeviceInfo();
    }

    // Obtener información del dispositivo
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timestamp: new Date().toISOString()
        };
    }

    // Obtener geolocalización
    async getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp).toISOString()
                    };
                    resolve(this.currentLocation);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // Subir foto con metadata
 // Convertir foto a Base64 (sin usar Storage)
async uploadPhoto(file) {
    try {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    success: true,
                    base64: e.target.result,
                    filename: file.name,
                    size: file.size,
                    type: file.type,
                    timestamp: new Date().toISOString()
                });
            };
            reader.onerror = (error) => {
                reject({
                    success: false,
                    error: error.message
                });
            };
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error('Error procesando foto:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

    // Crear encuesta con cadena de custodia
async createSurvey(surveyData) {
    try {
        const user = window.authManager.getCurrentUser();

        // Obtener ubicación actual
        let location = this.currentLocation;
        if (!location) {
            try {
                location = await this.getLocation();
            } catch (error) {
                console.warn('No se pudo obtener ubicación:', error);
                location = null;
            }
        }

        // Construir documento con cadena de custodia
        const surveyDocument = {
            ...surveyData,
            metadata: {
                createdAt: new Date().toISOString(),
                createdBy: user.uid,
                createdByEmail: user.email,
                deviceInfo: this.deviceInfo,
                location: location,
                ipAddress: await this.getIPAddress(),
                version: '1.0'
            },
            status: 'completed',
            lastModified: new Date().toISOString()
        };

        // Firebase real
        const db = window.firebaseApp.getDb();
        surveyDocument.metadata.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        surveyDocument.lastModified = firebase.firestore.FieldValue.serverTimestamp();
        
        const docRef = await db.collection('surveys').add(surveyDocument);

        return {
            success: true,
            id: docRef.id,
            data: surveyDocument
        };
    } catch (error) {
        console.error('Error creando encuesta:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

    // Obtener IP del usuario (aproximada)
    async getIPAddress() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Error obteniendo IP:', error);
            return 'unknown';
        }
    }

    // Obtener todas las encuestas
    async getSurveys(filters = {}) {
        try {
            const db = window.firebaseApp.getDb();
            let query = db.collection('surveys');

            // Aplicar filtros
            if (filters.municipality) {
                query = query.where('municipality', '==', filters.municipality);
            }
            if (filters.zone) {
                query = query.where('zone', '==', filters.zone);
            }
            if (filters.startDate) {
                query = query.where('metadata.createdAt', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('metadata.createdAt', '<=', filters.endDate);
            }

            // Ordenar por fecha
            query = query.orderBy('metadata.createdAt', 'desc');

            const snapshot = await query.get();
            const surveys = [];

            snapshot.forEach(doc => {
                surveys.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return {
                success: true,
                surveys: surveys,
                count: surveys.length
            };
        } catch (error) {
            console.error('Error obteniendo encuestas:', error);
            return {
                success: false,
                error: error.message,
                surveys: []
            };
        }
    }

    // Obtener encuesta por ID
    async getSurveyById(surveyId) {
        try {
            const db = window.firebaseApp.getDb();
            const doc = await db.collection('surveys').doc(surveyId).get();

            if (doc.exists) {
                return {
                    success: true,
                    survey: {
                        id: doc.id,
                        ...doc.data()
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'Encuesta no encontrada'
                };
            }
        } catch (error) {
            console.error('Error obteniendo encuesta:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Instancia global
window.surveyManager = new SurveyManager();