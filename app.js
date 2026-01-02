// --- FIREBASE AYARLARI ---
const firebaseConfig = {
    apiKey: "AIzaSyBZuPRkWaAyaKsRjLw8kTZpSduUlVSBqvQ",
    authDomain: "cezaapp.firebaseapp.com",
    databaseURL: "https://cezaapp-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "cezaapp",
    storageBucket: "cezaapp.firebasestorage.app",
    messagingSenderId: "786477452236",
    appId: "1:786477452236:web:b0a2ce9fb336b61ecb2b69"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const app = Vue.createApp({
    data() {
        return {
            theme: localStorage.getItem('theme') || 'dark',
            currentUser: localStorage.getItem('userRole') || null,
            selectedCategory: null,
            gameState: { status: 'IDLE' },
            // Notification State (Alert yerine geçecek)
            notification: { 
                show: false, 
                message: '', 
                type: 'alert', // 'alert' veya 'confirm'
                confirmText: 'Tamam',
                callback: null // Onay verilince çalışacak fonksiyon
            },
            
            // Ayarlar Modalı için
            showSettings: false,
            settingsTab: 'category', // category veya punishment
            newCategoryName: '',
            selectedCatForAdd: null,
            newPunishmentName: '',

            // Varsayılan Kategoriler (Eğer DB boşsa bu yüklenecek)
            categories: [
                { name: '1. Kategori', items: ['Masaj yap', 'Kahve ısmarla'] },
                { name: '2. Kategori', items: ['Evi süpür', 'Çöpleri at'] },
                { name: '3. Kategori', items: ['Şarkı söyle', 'Dans et'] },
                { name: '4. Kategori', items: ['Telefonu bırak', 'Kumanda teslim'] },
                { name: '5. Kategori', items: ['Sinema bileti', 'Sürpriz yap'] }
            ]
        }
    },
    computed: {
        amIDone() {
            if (this.currentUser === 'user1') return this.gameState.user1Done;
            return this.gameState.user2Done;
        }
    },
    mounted() {
        document.documentElement.setAttribute('data-theme', this.theme);

        // 1. Oyun Durumunu Dinle
        db.ref('game').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) this.gameState = data;
            else this.resetGame();
        });

        // 2. Kategorileri Veritabanından Çek
        db.ref('categories').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Eğer veritabanında varsa oradan al
                this.categories = data;
            } else {
                // Yoksa varsayılanları kaydet
                this.saveCategoriesToDb();
            }
        });
    },
    methods: {
        toggleTheme() {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', this.theme);
            localStorage.setItem('theme', this.theme);
        },
        login(role) {
            this.currentUser = role;
            localStorage.setItem('userRole', role);
        },
        givePunishment(punishmentName) {
            db.ref('game').set({
                status: 'PENDING',
                punishment: punishmentName,
                sender: this.currentUser,
                target: this.currentUser === 'user1' ? 'user2' : 'user1',
                user1Done: false,
                user2Done: false
            });
            this.selectedCategory = null;
        },
        acceptPunishment() { db.ref('game/status').set('ACTIVE'); },
        rejectPunishment() { alert("Reddedildi!"); this.resetGame(); },
        markDone() {
            const update = {};
            if (this.currentUser === 'user1') update['user1Done'] = true;
            else update['user2Done'] = true;
            db.ref('game').update(update).then(() => this.checkBothDone());
        },
        checkBothDone() {
            db.ref('game').once('value').then(snap => {
                const d = snap.val();
                if (d.user1Done && d.user2Done) {
                    setTimeout(() => { this.resetGame(); }, 1500);
                }
            });
        },
        resetGame() {
            db.ref('game').set({ status: 'IDLE', punishment: '', sender: '', target: '', user1Done: false, user2Done: false });
        },
        
        // --- AYARLAR YÖNETİMİ ---
        saveCategoriesToDb() {
            db.ref('categories').set(this.categories);
        },
        addNewCategory() {
            if (!this.newCategoryName) return alert("İsim yazmalısın!");
            // Yeni kategori ekle (boş items listesiyle)
            this.categories.push({
                name: this.newCategoryName,
                items: ['Örnek Ceza']
            });
            this.saveCategoriesToDb();
            this.newCategoryName = '';
            this.showAlert("Yeni kategori eklendi! 🎉");
        },
        addNewPunishment() {
            if (this.selectedCatForAdd === null) return alert("Kategori seçmelisin!");
            if (!this.newPunishmentName) return alert("Ceza yazmalısın!");

            // İlgili kategoriye push et
            if (!this.categories[this.selectedCatForAdd].items) {
                this.categories[this.selectedCatForAdd].items = [];
            }
            this.categories[this.selectedCatForAdd].items.push(this.newPunishmentName);
            
            this.saveCategoriesToDb();
            this.newPunishmentName = '';
            this.showAlert("Ceza başarıyla eklendi!");
        },

        deleteCategory(index) {
           this.showConfirm(
        this.categories[index].name + " kategorisini silmek istiyor musun?", 
        "Sil", 
        () => {
            // Kullanıcı 'Sil'e basarsa burası çalışır
            this.categories.splice(index, 1);
            this.saveCategoriesToDb();
            if (this.selectedCatForAdd === index) this.selectedCatForAdd = null;
        }
    );
        },

        deletePunishment(catIndex, itemIndex) {
            this.categories[catIndex].items.splice(itemIndex, 1);
            this.saveCategoriesToDb();
        },

        // --- YENİ BİLDİRİM FONKSİYONLARI ---
        showAlert(msg) {
            this.notification = { show: true, message: msg, type: 'alert', confirmText: 'Tamam' };
        },
        showConfirm(msg, confirmBtnText, actionCallback) {
            this.notification = { 
                show: true, 
                message: msg, 
                type: 'confirm', 
                confirmText: confirmBtnText, 
                callback: actionCallback 
            };
        },
        closeNotification(isConfirmed) {
            // Eğer confirm tipindeyse ve onay verildiyse callback'i çalıştır
            if (this.notification.type === 'confirm' && isConfirmed && this.notification.callback) {
                this.notification.callback();
            }
            this.notification.show = false;
        },
    }
});

app.mount('#app');