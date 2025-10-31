// js/encuesta.js
const products = [
    {id: 'maiz_blanco_menudeo', name: 'Maíz blanco al menudeo', unit: 'kg'},
    {id: 'maiz_blanco_25kg', name: 'Maíz blanco saco 25kg', unit: 'saco'},
    {id: 'maiz_amarillo_25kg', name: 'Maíz amarillo quebrado 25kg', unit: 'saco'},
    {id: 'alimento_engorda', name: 'Alimento de engorda 25kg', unit: 'saco'},
    {id: 'alimento_becerros', name: 'Alimento para becerros 25kg', unit: 'saco'},
    {id: 'alimento_lechera', name: 'Alimento vaca lechera 25kg', unit: 'saco'},
    {id: 'alimento_economico', name: 'Alimento económico 25kg', unit: 'saco'},
    {id: 'sal_mineral', name: 'Sal mineral para engorda', unit: 'unidad'}
];

let uploadedPhotos = [];

document.addEventListener('DOMContentLoaded', async () => {
    window.firebaseApp.init();
    
    // Esperar autenticación y carga de rol
    const checkAuth = new Promise((resolve) => {
        window.authManager.onAuthStateChanged((user, role) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            
            document.getElementById('userEmail').textContent = user.email;
            
            // Aplicar permisos
            window.permissionsManager.checkRouteAccess();
            window.permissionsManager.applyUIPermissions();
            
            resolve();
        });
    });

    await checkAuth;

// Deshabilitar envío para supervisor
const role = window.authManager.getCurrentRole();
if (role === 'supervisor') {
    document.getElementById('supervisorWarning').style.display = 'block';
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'No disponible para supervisores';
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
}

    // Manejar cambio en tipo de establecimiento
    document.querySelectorAll('[name="establishmentType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const otherContainer = document.getElementById('otherTypeContainer');
            const otherInput = document.getElementById('otherTypeInput');
            
            if (this.value === 'Otro') {
                otherContainer.style.display = 'block';
                otherInput.required = true;
            } else {
                otherContainer.style.display = 'none';
                otherInput.required = false;
                otherInput.value = '';
            }
        });
    });

    // Manejar preguntas de alimentación
    document.querySelectorAll('[name="combinesGrain"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const container = document.getElementById('grainTypeContainer');
            const input = document.getElementById('grainType');
            if (this.value === 'si') {
                container.style.display = 'block';
                input.required = true;
            } else {
                container.style.display = 'none';
                input.required = false;
                input.value = '';
            }
        });
    });

    document.querySelectorAll('[name="usesMolasses"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const container = document.getElementById('molassesReasonContainer');
            if (this.value === 'si') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
                document.querySelector('[name="molassesReason"]').value = '';
            }
        });
    });

    document.querySelectorAll('[name="usesPoultryLitter"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const container = document.getElementById('poultryLitterReasonContainer');
            if (this.value === 'si') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
                document.querySelector('[name="poultryLitterReason"]').value = '';
            }
        });
    });

        // Sistema dinámico de zonas y municipios
        document.querySelectorAll('[name="zone"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const zone = this.value;
                const municipalities = locationsData[zone].municipalities;
                
                // Mostrar municipios con animación
                const municipalityGroup = document.getElementById('municipalityGroup');
                const municipalityOptions = document.getElementById('municipalityOptions');
                
                // Limpiar selección anterior
                municipalityOptions.innerHTML = '';
                document.getElementById('establishmentSuggestionsGroup').style.display = 'none';
                document.getElementById('establishmentNameGroup').style.display = 'none';
                
                // Crear opciones de municipios
                municipalities.forEach(mun => {
                    const label = document.createElement('label');
                    label.className = 'checkbox-label';
                    label.innerHTML = `
                        <input type="radio" name="municipality" value="${mun}" required>
                        <span>${mun}</span>
                    `;
                    municipalityOptions.appendChild(label);
                });
                
                // Mostrar con animación
                municipalityGroup.style.display = 'block';
                setTimeout(() => {
                    municipalityGroup.style.opacity = '1';
                    municipalityGroup.classList.add('fade-in');
                }, 10);
                
                // Agregar listeners a los nuevos municipios
                attachMunicipalityListeners(zone);
            });
        });
    
     
        function attachMunicipalityListeners(zone) {
            document.querySelectorAll('[name="municipality"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    const municipality = this.value;
                    const establishments = locationsData[zone].establishments[municipality];
                    
                    // Mostrar sugerencias
                    const suggestionsGroup = document.getElementById('establishmentSuggestionsGroup');
                    const suggestionsList = document.getElementById('establishmentSuggestions');
                    const nameGroup = document.getElementById('establishmentNameGroup');
                    
                    suggestionsList.innerHTML = '';
                    
                    // Agregar establecimientos de la zona
                    establishments.forEach(est => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.textContent = est;
                        item.addEventListener('click', function() {
                            // Marcar como seleccionado
                            document.querySelectorAll('.suggestion-item').forEach(i => i.classList.remove('selected'));
                            this.classList.add('selected');
                            
                            // Llenar el input
                            document.getElementById('establishmentNameInput').value = est.split(' - ')[0];
                            document.getElementById('establishmentNameInput').readOnly = false;
                        });
                        suggestionsList.appendChild(item);
                    });
                    
                    // Agregar opción "Otro"
                    const otherItem = document.createElement('div');
                    otherItem.className = 'suggestion-item suggestion-other';
                    otherItem.innerHTML = '<strong>➕ Otro establecimiento (no listado)</strong>';
                    otherItem.addEventListener('click', function() {
                        // Marcar como seleccionado
                        document.querySelectorAll('.suggestion-item').forEach(i => i.classList.remove('selected'));
                        this.classList.add('selected');
                        
                        // Limpiar y habilitar el input
                        const input = document.getElementById('establishmentNameInput');
                        input.value = '';
                        input.readOnly = false;
                        input.focus();
                        input.placeholder = 'Ingrese el nombre del establecimiento';
                    });
                    suggestionsList.appendChild(otherItem);
                    
                    // Mostrar con animación
                    suggestionsGroup.style.display = 'block';
                    nameGroup.style.display = 'block';
                    setTimeout(() => {
                        suggestionsGroup.style.opacity = '1';
                        nameGroup.style.opacity = '1';
                        suggestionsGroup.classList.add('fade-in');
                        nameGroup.classList.add('fade-in');
                    }, 10);
                });
            });
        }
    

  

    // Renderizar productos
    renderProducts();

    // Manejo de fotos
    document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);

    // Submit form
    document.getElementById('surveyForm').addEventListener('submit', handleSubmit);
});

function renderProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';
    
    products.forEach(p => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <h3>${p.name}</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Disponible</label>
                    <select class="form-control" name="product_${p.id}_available">
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Precio (por ${p.unit})</label>
                    <input type="number" step="0.01" class="form-control" name="product_${p.id}_price" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Marca</label>
                    <input type="text" class="form-control" name="product_${p.id}_brand">
                </div>
            </div>
            <div class="form-row mt-10">
                <div class="form-group">
                    <label>Tendencia del Precio</label>
                    <select class="form-control" name="product_${p.id}_trend">
                        <option value="">No especificado</option>
                        <option value="estable">Precio estable</option>
                        <option value="aumento_1mes">Aumentó hace 1 mes</option>
                        <option value="aumento_3meses">Aumentó hace 3 meses</option>
                        <option value="aumento_6meses">Aumentó hace 6 meses</option>
                        <option value="aumento_12meses">Aumentó hace 12 meses</option>
                        <option value="disminucion_1mes">Disminuyó hace 1 mes</option>
                        <option value="disminucion_3meses">Disminuyó hace 3 meses</option>
                        <option value="disminucion_6meses">Disminuyó hace 6 meses</option>
                        <option value="disminucion_12meses">Disminuyó hace 12 meses</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Precio Anterior (opcional)</label>
                    <input type="number" step="0.01" class="form-control" name="product_${p.id}_previous_price" placeholder="0.00">
                </div>
            </div>
        `;
        container.appendChild(productCard);
    });
}

function handlePhotoUpload(e) {
    const preview = document.getElementById('photoPreview');
    Array.from(e.target.files).forEach(file => {
        uploadedPhotos.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

async function handleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Organizar productos
    const productsData = {};
    products.forEach(p => {
        productsData[p.id] = {
            name: p.name,
            available: data[`product_${p.id}_available`],
            price: data[`product_${p.id}_price`] || null,
            brand: data[`product_${p.id}_brand`] || null,
            trend: data[`product_${p.id}_trend`] || null,
            previousPrice: data[`product_${p.id}_previous_price`] || null
        };
    });

    const surveyData = {
        zone: data.zone,
        municipality: data.municipality,
        establishmentName: data.establishmentName,
        establishmentType: establishmentType,
        products: productsData,
        // Nuevas preguntas de alimentación
        feedingPractices: {
            combinesGrain: data.combinesGrain,
            grainType: data.grainType || null,
            usesMolasses: data.usesMolasses,
            molassesReason: data.molassesReason || null,
            usesPoultryLitter: data.usesPoultryLitter,
            poultryLitterReason: data.poultryLitterReason || null,
            otherIngredients: data.otherIngredients || null,
            combinationBenefits: data.combinationBenefits || null
        },
        observations: data.observations || '',
        photos: []
    };

    // Guardar encuesta
    const result = await window.surveyManager.createSurvey(surveyData);
    
    if (result.success) {
        // Subir fotos
        for (const photo of uploadedPhotos) {
            await window.surveyManager.uploadPhoto(photo, result.id);
        }
        
        alert('✅ Encuesta guardada exitosamente');
        window.location.href = 'listae.html';
    } else {
        alert('❌ Error: ' + result.error);
        btn.disabled = false;
        btn.textContent = 'Guardar Encuesta';
    }
}

function logout() {
    window.authManager.logout();
    window.location.href = 'index.html';
}