const firebaseConfig = {
        apiKey: "AIzaSyDpPEkKbEt6b_v2OWlBfGuaVQpBg2-RWR4",
        authDomain: "cwu-gen-2.firebaseapp.com",
        databaseURL: "https://cwu-gen-2-default-rtdb.firebaseio.com",
        projectId: "cwu-gen-2",
        storageBucket: "cwu-gen-2.appspot.com",
        messagingSenderId: "40585612014",
        appId: "1:40585612014:web:c88141fee369aca68181ff",
        measurementId: "G-S8D7DFJ1G3"
    };

    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const dataRef = database.ref('dataAnggota/');
    const configRef = database.ref('konfigurasi/');

    // Elemen DOM
    const loadingElement = document.getElementById('loading');
    const dataTable = document.getElementById('dataTable');
    const tableBody = dataTable.querySelector('tbody');
    const tglAcaraInput = document.getElementById('tglAcaraInput');
    const setTanggalBtn = document.getElementById('setTanggalBtn');
    const currentTanggalElement = document.getElementById('currentTanggal');
    const filterTanggalSelect = document.getElementById('filterTanggal');
    const totalOverallElement = document.getElementById('totalOverall');
    const selectAllCheckbox = document.getElementById('selectAll');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const exportBtn = document.getElementById('exportBtn');
    const soldItemsForm = document.getElementById('soldItemsForm');
    const soldItemsList = document.getElementById('soldItemsList');
    const individualSellerProfitList = document.getElementById('individualSellerProfit');
    const totalSellerProfitElement = document.getElementById('totalSellerProfit');
    const totalChairProfitElement = document.getElementById('totalChairProfit');
    const toggleFormBtn = document.getElementById('toggleFormBtn');

    // Cache data
    let allDataCache = {};
    let soldUnitsByProduct = {};
    let uniqueProducts = {};
    let sellerProducts = {};

    // Format tanggal & rupiah
    const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    // === SIMPAN DATA TERJUAL KE FIREBASE ===
    function saveSoldItemToDatabase(productName, soldUnits, hargaSatuan) {
        const selectedDate = filterTanggalSelect.value || 'tanpa_tanggal';
        const totalHarga = soldUnits * hargaSatuan;
        const waktuUpdate = new Date().toISOString();

        const soldRef = database.ref(`barangTerjual/${selectedDate}/${productName}`);
        soldRef.set({
            namaProduk: productName,
            jumlahTerjual: soldUnits,
            hargaSatuan: hargaSatuan,
            totalHarga: totalHarga,
            waktuUpdate: waktuUpdate
        }).then(() => {
            console.log(`✅ ${productName} tersimpan: ${soldUnits} unit (${formatRupiah(totalHarga)})`);
        }).catch((error) => {
            console.error('❌ Gagal simpan:', error);
        });
    }

    const backLink = document.getElementById('backLink');

backLink.addEventListener('click', (e) => {
  e.preventDefault();

  // Buat efek keluar animasi sebelum redirect
  document.body.style.transition = 'opacity 0.5s ease';
  document.body.style.opacity = '0';

  setTimeout(() => {
    window.location.href = 'https://admcwudrops.vercel.app';
  }, 500);
});

    // === MUAT DATA TERJUAL DARI FIREBASE ===
    function loadSoldItemsFromDatabase(sellerData, products) {
        const selectedDate = filterTanggalSelect.value || 'tanpa_tanggal';
        const soldRef = database.ref(`barangTerjual/${selectedDate}`);

        soldRef.once('value').then(snapshot => {
            const soldData = snapshot.val() || {};
            document.querySelectorAll('.jumlah-terjual').forEach(input => {
                const productName = input.getAttribute('data-product-name');
                if (soldData[productName]) {
                    const jumlah = soldData[productName].jumlahTerjual || 0;
                    input.value = jumlah;
                }
            });
            calculateProfits(sellerData, products);
            console.log('✅ Data terjual dimuat dari Firebase');
        }).catch(error => {
            console.error('❌ Gagal memuat data terjual:', error);
        });
    }

    // === RENDER TABEL DATA ===
    function renderTable(data, filterDate = '') {
        tableBody.innerHTML = '';
        let isDataFound = false;
        let grandTotal = 0;
        uniqueProducts = {};
        sellerProducts = {};

        if (!data || Object.keys(data).length === 0) {
            loadingElement.textContent = `Belum ada data sama sekali.`;
            loadingElement.style.display = 'block';
            dataTable.style.display = 'none';
            totalOverallElement.style.display = 'none';
            soldItemsForm.style.display = 'none';
            return;
        }

        Object.values(data).forEach(anggota => {
            if (filterDate === '' || anggota.tanggal === filterDate) {
                const hasImage = anggota.uploadImageCheck || false;
                if (anggota.katalogProduk && anggota.katalogProduk.length > 0) {
                    if (!sellerProducts[anggota.namaLengkap]) {
                        sellerProducts[anggota.namaLengkap] = {};
                    }

                    anggota.katalogProduk.forEach((produk, produkIndex) => {
                        const totalPerBaris = produk.jumlahUnit * produk.hargaSatuan;
                        grandTotal += totalPerBaris;
                        const productName = produk.namaProduk.toLowerCase();

                        if (!uniqueProducts[productName]) {
                            uniqueProducts[productName] = {
                                namaProduk: produk.namaProduk,
                                totalUnit: 0,
                                hargaSatuan: produk.hargaSatuan,
                            };
                        }
                        uniqueProducts[productName].totalUnit += produk.jumlahUnit;

                        if (!sellerProducts[anggota.namaLengkap][productName]) {
                            sellerProducts[anggota.namaLengkap][productName] = {
                                namaProduk: produk.namaProduk,
                                jumlahUnit: 0,
                                hargaSatuan: produk.hargaSatuan
                            };
                        }
                        sellerProducts[anggota.namaLengkap][productName].jumlahUnit += produk.jumlahUnit;

                        const newRow = document.createElement('tr');
                        newRow.innerHTML = `
                            <td><input type="checkbox" data-key="${anggota.key}" data-index="${produkIndex}"></td>
                            <td data-label="Nama Lengkap">${anggota.namaLengkap} ${hasImage ? '<i class="fas fa-camera photo-icon"></i>' : ''}</td>
                            <td data-label="Nama Produk">${produk.namaProduk}</td>
                            <td data-label="Jumlah Unit">${produk.jumlahUnit}</td>
                            <td data-label="Harga Satuan">${formatRupiah(produk.hargaSatuan)}</td>
                            <td data-label="Total per Baris"><strong>${formatRupiah(totalPerBaris)}</strong></td>
                        `;
                        tableBody.appendChild(newRow);
                        isDataFound = true;
                    });
                }
            }
        });

        if (isDataFound) {
            loadingElement.style.display = 'none';
            dataTable.style.display = 'table';
            totalOverallElement.innerHTML = `Total Keseluruhan: <strong>${formatRupiah(grandTotal)}</strong>`;
            totalOverallElement.style.display = 'block';
            renderSoldItemsForm(uniqueProducts, sellerProducts);
            loadSoldItemsFromDatabase(sellerProducts, uniqueProducts); // ⬅️ tambahkan di sini
        } else {
            loadingElement.textContent = `Belum ada data untuk tanggal ini.`;
            loadingElement.style.display = 'block';
            dataTable.style.display = 'none';
            totalOverallElement.style.display = 'none';
            soldItemsForm.style.display = 'none';
        }
    }
    

    // === RENDER FORM PENJUALAN ===
    function renderSoldItemsForm(products, sellerData) {
    const productArray = Object.values(products);
    if (productArray.length > 0) {
        soldItemsForm.style.display = 'block';
        soldItemsList.innerHTML = '';
        productArray.forEach(product => {
            const productItem = document.createElement('div');
            productItem.classList.add('sold-item');
            productItem.style.display = 'flex';
            productItem.style.justifyContent = 'space-between';
            productItem.style.alignItems = 'center';
            productItem.style.background = 'linear-gradient(135deg, #f0f4ff, #dbe4ff)';
            productItem.style.padding = '12px 20px';
            productItem.style.borderRadius = '12px';
            productItem.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
            productItem.style.marginBottom = '12px';
            productItem.style.transition = 'transform 0.2s, box-shadow 0.2s';

            productItem.addEventListener('mouseenter', () => {
                productItem.style.transform = 'translateY(-2px)';
                productItem.style.boxShadow = '0 12px 25px rgba(0,0,0,0.12)';
            });
            productItem.addEventListener('mouseleave', () => {
                productItem.style.transform = 'translateY(0)';
                productItem.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
            });

            productItem.innerHTML = `
                <label style="font-weight:600; font-size:16px; color:#0d47a1; flex:1;">${product.namaProduk} (${product.totalUnit} unit)</label>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button type="button" class="decrease-btn" 
                            data-product-name="${product.namaProduk.toLowerCase()}"
                            style="
                                width:40px; height:40px;
                                border:none; border-radius:50%;
                                background:#f44336; color:white; font-size:20px;
                                cursor:pointer; transition:all 0.2s;
                            ">-</button>
                    <input type="text"
                           class="jumlah-terjual"
                           value="0"
                           readonly
                           data-harga-satuan="${product.hargaSatuan}"
                           data-product-name="${product.namaProduk.toLowerCase()}"
                           style="
                                width:70px; text-align:center; font-weight:bold;
                                border:none; border-radius:10px; background:#e3f2fd;
                                padding:6px 0; font-size:16px; color:#0d47a1;
                                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                           ">
                    <button type="button" class="increase-btn"
                            data-product-name="${product.namaProduk.toLowerCase()}"
                            style="
                                width:40px; height:40px;
                                border:none; border-radius:50%;
                                background:#4caf50; color:white; font-size:20px;
                                cursor:pointer; transition:all 0.2s;
                            ">+</button>
                </div>
            `;
            soldItemsList.appendChild(productItem);
        });

        // Tombol +
        soldItemsList.querySelectorAll('.increase-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const productName = btn.getAttribute('data-product-name');
                const input = soldItemsList.querySelector(`.jumlah-terjual[data-product-name="${productName}"]`);
                let value = parseInt(input.value) || 0;
                const max = parseInt(products[productName].totalUnit);
                if (value < max) {
                    input.value = value + 1;
                    calculateProfits(sellerData, products);
                    saveSoldItemToDatabase(productName, value + 1, parseInt(input.getAttribute('data-harga-satuan')));
                }
            });
        });

        // Tombol -
        soldItemsList.querySelectorAll('.decrease-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const productName = btn.getAttribute('data-product-name');
                const input = soldItemsList.querySelector(`.jumlah-terjual[data-product-name="${productName}"]`);
                let value = parseInt(input.value) || 0;
                if (value > 0) {
                    input.value = value - 1;
                    calculateProfits(sellerData, products);
                    saveSoldItemToDatabase(productName, value - 1, parseInt(input.getAttribute('data-harga-satuan')));
                }
            });
        });

        calculateProfits(sellerData, products);
    } else {
        soldItemsForm.style.display = 'none';
    }
}


    // === HITUNG KEUNTUNGAN ===
    // === HITUNG KEUNTUNGAN ===
function calculateProfits(sellerData, totalProducts) {
    soldUnitsByProduct = {};
    let isValid = true;
    let totalSoldUnits = 0;

    soldItemsList.querySelectorAll('.jumlah-terjual').forEach(input => {
        const value = parseInt(input.value) || 0;
        const maxUnits = parseInt(input.getAttribute('max'));
        const productName = input.getAttribute('data-product-name');
        if (value > maxUnits) {
            input.classList.add('input-error');
            isValid = false;
        } else {
            input.classList.remove('input-error');
            soldUnitsByProduct[productName] = value;
            totalSoldUnits += value;
        }
    });

    if (isValid) {
        const individualProfits = {};
        let totalSellerProfit = 0;

        // Hitung total keuntungan tiap penjual
        for (const seller in sellerData) {
            let sellerProfit = 0;
            for (const product in sellerData[seller]) {
                const productData = sellerData[seller][product];
                const soldUnits = soldUnitsByProduct[product] || 0;
                if (soldUnits > 0) {
                    const totalUnitsInStock = totalProducts[product].totalUnit;
                    const share = productData.jumlahUnit / totalUnitsInStock;
                    const sellerShareOfTotalSales = share * soldUnits * productData.hargaSatuan;
                    sellerProfit += sellerShareOfTotalSales;
                }
            }
            if (sellerProfit > 0) {
                individualProfits[seller] = sellerProfit;
                totalSellerProfit += sellerProfit;
            }
        }

        // Hitung keuntungan ketua (10%)
        const chairProfit = totalSellerProfit * 0.10;
        const netSellerProfit = totalSellerProfit - chairProfit;

        // Tampilkan hasil di UI
        individualSellerProfitList.innerHTML = '<h4>Keuntungan Kotor Tiap Penjual:</h4>';
        for (const seller in individualProfits) {
            const li = document.createElement('li');
            li.textContent = `${seller}: ${formatRupiah(individualProfits[seller])}`;
            individualSellerProfitList.appendChild(li);
        }

        totalSellerProfitElement.innerHTML =
            `Total Keuntungan Kotor Penjual: <strong>${formatRupiah(totalSellerProfit)}</strong><br>
             Keuntungan Bersih Penjual (setelah potongan 10%): <strong>${formatRupiah(netSellerProfit)}</strong>`;
        totalChairProfitElement.innerHTML =
            `Keuntungan CWU (10%): <strong>${formatRupiah(chairProfit)}</strong>`;
    } else {
        individualSellerProfitList.innerHTML = '';
        totalSellerProfitElement.textContent = `Terdapat input yang tidak valid!`;
        totalChairProfitElement.textContent = '';
    }
}


    // === EVENT ===
    setTanggalBtn.addEventListener('click', () => {
        const selectedDate = tglAcaraInput.value;
        if (selectedDate) {
            const formatted = formatDate(selectedDate);
            configRef.update({ tanggalAcara: formatted })
                .then(() => alert(`Tanggal acara berhasil diatur menjadi ${formatted}`))
                .catch((e) => alert('Gagal mengatur tanggal: ' + e.message));
        } else alert('Silakan pilih tanggal terlebih dahulu.');
    });

    toggleFormBtn.addEventListener('click', () => {
        configRef.once('value', (snapshot) => {
            const current = snapshot.val()?.formStatus || false;
            configRef.update({ formStatus: !current })
                .then(() => alert(`Formulir berhasil di${!current ? 'nyalakan' : 'matikan'}.`))
                .catch((e) => alert('Gagal mengubah status: ' + e.message));
        });
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const checks = tableBody.querySelectorAll('input[type="checkbox"]');
        checks.forEach(c => c.checked = e.target.checked);
    });

    deleteSelectedBtn.addEventListener('click', () => {
        const selected = tableBody.querySelectorAll('input[type="checkbox"]:checked');
        if (!selected.length) return alert('Pilih setidaknya satu data.');
        if (!confirm(`Yakin hapus ${selected.length} data?`)) return;
        const updates = {};
        selected.forEach(cb => {
            const key = cb.dataset.key;
            const index = parseInt(cb.dataset.index);
            if (allDataCache[key]) {
                const updated = [...allDataCache[key].katalogProduk];
                updated.splice(index, 1);
                if (updated.length > 0) updates[`/dataAnggota/${key}/katalogProduk`] = updated;
                else updates[`/dataAnggota/${key}`] = null;
            }
        });
        database.ref().update(updates)
            .then(() => alert('Data berhasil dihapus.'))
            .catch(err => alert('Gagal hapus: ' + err.message));
    });

    filterTanggalSelect.addEventListener('change', () => {
        renderTable(allDataCache, filterTanggalSelect.value);
    });

    dataRef.on('value', (snap) => {
        const data = snap.val();
        allDataCache = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { ...v, key: k }])) : {};
        const uniqueDates = new Set();
        if (data) Object.values(data).forEach(d => d.tanggal && uniqueDates.add(d.tanggal));
        filterTanggalSelect.innerHTML = '<option value="">Semua Tanggal</option>';
        Array.from(uniqueDates).sort().forEach(date => {
            const o = document.createElement('option');
            o.value = date; o.textContent = date;
            filterTanggalSelect.appendChild(o);
        });
        renderTable(allDataCache, filterTanggalSelect.value);
    });

    configRef.on('value', (snap) => {
        const cfg = snap.val();
        currentTanggalElement.textContent = cfg?.tanggalAcara || "Belum diatur";
        if (cfg && cfg.formStatus !== undefined) {
            toggleFormBtn.textContent = cfg.formStatus ? 'Matikan Formulir' : 'Nyalakan Formulir';
            toggleFormBtn.classList.toggle('on', cfg.formStatus);
            toggleFormBtn.classList.toggle('off', !cfg.formStatus);
        }
    });