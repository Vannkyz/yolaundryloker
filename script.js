// ============ KONFIGURASI SUPABASE ============
// GANTI DENGAN CREDENTIAL SUPABASE ANDA!
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';

// Inisialisasi Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ VARIABEL GLOBAL ============
let currentLoker = 1;
let autoBackupInterval = null;
let currentFotoUrl = null;

// ============ INISIALISASI ============
document.addEventListener('DOMContentLoaded', async () => {
    generateLokerNavigation();
    attachEventListeners();
    await loadAllData();
    setCurrentDate();
    startAutoBackup();
});

// Generate 40 tombol loker
function generateLokerNavigation() {
    const nav = document.getElementById('lokerNav');
    nav.innerHTML = '';
    for (let i = 1; i <= 40; i++) {
        const btn = document.createElement('button');
        btn.className = 'loker-btn';
        btn.textContent = `Loker ${i}`;
        btn.onclick = () => selectLoker(i);
        nav.appendChild(btn);
    }
    selectLoker(1);
}

// Select loker
async function selectLoker(lokerNumber) {
    currentLoker = lokerNumber;
    document.getElementById('lokerTitle').textContent = `Loker #${lokerNumber}`;
    
    // Update active class
    document.querySelectorAll('.loker-btn').forEach((btn, idx) => {
        if (idx + 1 === lokerNumber) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    await loadLokerData(lokerNumber);
}

// Load data loker tertentu
async function loadLokerData(lokerNumber) {
    try {
        const { data, error } = await supabase
            .from('lockers')
            .select('*')
            .eq('loker_number', lokerNumber)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error loading data:', error);
            return;
        }
        
        if (data) {
            document.getElementById('namaCustomer').value = data.nama_customer || '';
            document.getElementById('pinLoker').value = data.pin || '';
            document.getElementById('tanggal').value = data.tanggal || getCurrentDate();
            document.getElementById('status').value = data.status || 'belum';
            currentFotoUrl = data.foto_url;
            
            if (currentFotoUrl) {
                displayFotoPreview(currentFotoUrl);
            } else {
                document.getElementById('fotoPreview').innerHTML = '';
            }
        } else {
            // Reset form jika tidak ada data
            document.getElementById('namaCustomer').value = '';
            document.getElementById('pinLoker').value = '';
            document.getElementById('tanggal').value = getCurrentDate();
            document.getElementById('status').value = 'belum';
            document.getElementById('fotoPreview').innerHTML = '';
            currentFotoUrl = null;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Load semua data untuk ditampilkan di grid
async function loadAllData() {
    try {
        const { data, error } = await supabase
            .from('lockers')
            .select('*')
            .order('loker_number');
        
        if (error) throw error;
        
        // Update indikator tombol loker
        document.querySelectorAll('.loker-btn').forEach((btn, idx) => {
            const lokerNum = idx + 1;
            const hasData = data.some(d => d.loker_number === lokerNum);
            if (hasData) {
                btn.classList.add('has-data');
            } else {
                btn.classList.remove('has-data');
            }
        });
        
        // Tampilkan semua data di grid
        displayAllLokers(data);
    } catch (error) {
        console.error('Error loading all data:', error);
    }
}

// Display semua loker di grid
function displayAllLokers(data) {
    const container = document.getElementById('allLokersData');
    container.innerHTML = '';
    
    for (let i = 1; i <= 40; i++) {
        const lokerData = data.find(d => d.loker_number === i);
        const card = document.createElement('div');
        card.className = 'loker-card';
        
        if (lokerData) {
            card.innerHTML = `
                <h4>Loker #${i}</h4>
                <p><strong>Customer:</strong> ${lokerData.nama_customer || '-'}</p>
                <p><strong>PIN:</strong> ${lokerData.pin || '-'}</p>
                <p><strong>Tanggal:</strong> ${lokerData.tanggal || '-'}</p>
                <p><strong>Status:</strong> ${lokerData.status === 'sudah' ? '✅ Sudah Diambil' : '⏳ Belum Diambil'}</p>
                <p><strong>Petugas:</strong> ${lokerData.petugas || '-'}</p>
                ${lokerData.foto_url ? `<div class="card-foto"><img src="${lokerData.foto_url}" alt="Foto bukti" onclick="zoomImage('${lokerData.foto_url}')"></div>` : '<p><em>Tidak ada foto</em></p>'}
            `;
        } else {
            card.innerHTML = `
                <h4>Loker #${i}</h4>
                <p><em>Kosong / Belum ada data</em></p>
            `;
        }
        
        container.appendChild(card);
    }
}

// Simpan data
async function saveData() {
    const namaCustomer = document.getElementById('namaCustomer').value.trim();
    const pin = document.getElementById('pinLoker').value.trim();
    const status = document.getElementById('status').value;
    const petugas = document.getElementById('petugasSelect').value;
    const tanggal = getCurrentDate();
    
    if (!namaCustomer) {
        showMessage('Nama customer harus diisi!', 'error');
        return;
    }
    
    if (!pin || pin.length < 4) {
        showMessage('PIN harus minimal 4 digit!', 'error');
        return;
    }
    
    if (!petugas) {
        showMessage('Pilih petugas terlebih dahulu!', 'error');
        return;
    }
    
    showMessage('Menyimpan data...', 'success');
    
    try {
        let fotoUrl = currentFotoUrl;
        
        // Upload foto jika ada
        const fotoFile = document.getElementById('fotoUpload').files[0];
        if (fotoFile) {
            const fileName = `loker_${currentLoker}_${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('loker-photos')
                .upload(fileName, fotoFile);
            
            if (uploadError) throw uploadError;
            
            const { data: publicUrl } = supabase.storage
                .from('loker-photos')
                .getPublicUrl(fileName);
            
            fotoUrl = publicUrl.publicUrl;
        }
        
        // Simpan ke database
        const { data, error } = await supabase
            .from('lockers')
            .upsert({
                loker_number: currentLoker,
                nama_customer: namaCustomer,
                pin: pin,
                tanggal: tanggal,
                status: status,
                petugas: petugas,
                foto_url: fotoUrl,
                updated_at: new Date()
            }, { onConflict: 'loker_number' });
        
        if (error) throw error;
        
        showMessage('Data berhasil disimpan!', 'success');
        await loadAllData();
        await loadLokerData(currentLoker);
        document.getElementById('fotoUpload').value = '';
        
    } catch (error) {
        console.error('Error saving:', error);
        showMessage('Gagal menyimpan data: ' + error.message, 'error');
    }
}

// Bersihkan form
function clearForm() {
    document.getElementById('namaCustomer').value = '';
    document.getElementById('pinLoker').value = '';
    document.getElementById('status').value = 'belum';
    document.getElementById('fotoUpload').value = '';
    document.getElementById('fotoPreview').innerHTML = '';
    currentFotoUrl = null;
    setCurrentDate();
    showMessage('Form telah dibersihkan', 'success');
}

// Hapus semua data loker saat ini
async function clearAllData() {
    if (confirm(`Yakin ingin menghapus SEMUA data Loker #${currentLoker}?`)) {
        try {
            const { error } = await supabase
                .from('lockers')
                .delete()
                .eq('loker_number', currentLoker);
            
            if (error) throw error;
            
            showMessage(`Semua data Loker #${currentLoker} telah dihapus`, 'success');
            await loadAllData();
            await loadLokerData(currentLoker);
        } catch (error) {
            showMessage('Gagal menghapus data: ' + error.message, 'error');
        }
    }
}

// Auto backup setiap 10 detik
function startAutoBackup() {
    if (autoBackupInterval) clearInterval(autoBackupInterval);
    autoBackupInterval = setInterval(async () => {
        console.log('Auto-sync running...');
        await loadAllData();
    }, 10000);
}

// Helper functions
function getCurrentDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function setCurrentDate() {
    document.getElementById('tanggal').value = getCurrentDate();
}

function displayFotoPreview(url) {
    const preview = document.getElementById('fotoPreview');
    preview.innerHTML = `<img src="${url}" alt="Preview" onclick="zoomImage('${url}')" style="cursor: pointer;">`;
}

function showMessage(msg, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.textContent = msg;
    msgDiv.className = `message ${type}`;
    setTimeout(() => {
        msgDiv.style.display = 'none';
        msgDiv.className = 'message';
    }, 3000);
    msgDiv.style.display = 'block';
}

function zoomImage(url) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'block';
    modalImg.src = url;
}

function attachEventListeners() {
    document.getElementById('saveBtn').addEventListener('click', saveData);
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    document.getElementById('clearAllDataBtn').addEventListener('click', clearAllData);
    
    // Petugas selector display
    document.getElementById('petugasSelect').addEventListener('change', (e) => {
        const display = document.getElementById('selectedPetugasDisplay');
        if (e.target.value) {
            display.textContent = `Petugas aktif: ${e.target.value}`;
        } else {
            display.textContent = '';
        }
    });
    
    // Modal close
    const modal = document.getElementById('imageModal');
    const closeBtn = document.getElementsByClassName('close')[0];
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

// Expose zoomImage ke global
window.zoomImage = zoomImage;
