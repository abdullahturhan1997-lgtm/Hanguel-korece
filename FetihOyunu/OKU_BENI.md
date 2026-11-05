# ⚔️ FETİH — Mobil Strateji ve Savaş Oyunu

Sevimli, gölgeli çizimli bir mini dünya haritasında 40 kişilik bir köyden cihan devletine.
Oyun tamamen çevrimdışı çalışır: HTML5 Canvas + JavaScript, Android WebView içinde (`app/src/main/assets`).

## Çalıştırma
- **Tarayıcıda deneme:** `app/src/main/assets/index.html` dosyasını açın (klavye: WASD/oklar hareket, Boşluk vur, 1-2-3 emirler, N nida, R ricat).
- **APK:** GitHub → Actions → *Fetih Oyunu APK Olustur* → Run workflow → Artifacts → `Fetih-Oyunu-APK`.
  (`FetihOyunu/**` değişince otomatik de çalışır.) Android Studio ile `FetihOyunu` klasörü de açılabilir.

## İsteklerin karşılığı
| # | Özellik | Nerede |
|---|---|---|
| 1-3 | Dünyaya benzeyen mini harita, yumuşak gölgeli "yastık" kıtalar, ağaçlar, dağlar | `js/map.js` |
| 2, 5 | 18 merkezî şehir, her birinin kendine has savunması (ör. **Afyon Kalesi – Kaya Sur**: kayalar yuvarlanır) | `js/data.js → DEFENSES` |
| 4 | Her milletin sınırı çizilir, herkes herkese saldırabilir | harita + diplomasi |
| 6 | Kültürel asker başlıkları araştırılıp seçilir (Börk, Sivri miğfer, Kabuto…) | Komutan / Asker Kuşan |
| 7-9 | Kaleyi zaptet → Tebaya kat / Köleleştir / Katlet / Yerle bir et | fetih penceresi |
| 10, 25, 26 | Nüfus sürekli artar; erkek/kadın/yaşlı/çocuk görünür; 40 kişiyle başlanır; konut kapasitesi | 👪 düğmesi, Yapılar |
| 11, 12 | İttifak; müttefikten asker iste (emrine girer) / kendi ordunu müttefiğe devret | Diplomasi |
| 13-16, 38 | Hazine (vergi, fetih, ticaret, yağma); tek birim altın; anında kuşanma; okçu/mızraklı/piyade/atlı, mancınık, kuşatma kulesi, top, gülle, zırh; paralı asker | Şehir → Asker Kuşan |
| 17, 18, 34 | Birebir yönetilen savaş; kan ve ikiye bölünme (ayarlardan kapatılabilir); kuleden ok, mancınık/topla sur yıkma | `js/battle.js` |
| 20 | Çöp adam komutanı giydirme (başlık, zırh, silah, kalkan, sakal, pelerin) | Komutan |
| 21 | Komutan ölürse yaralanır, şehrine götürülür, savaş kaybedilir, ordu çekilir | |
| 22 | Meydan savaşına davet (YZ de seni davet eder) | Diplomasi / Ulak |
| 23 | Fethedilen şehrin savunması yeni sahibinindir | |
| 24 | Şehir dizaynı: hangi bina nereye | Şehir → Yapılar |
| 27, 31 | Yol kesme (kervan yağması), şehir yağması, yol üstünde pusu | ordu kartı |
| 28, 29 | Kervanlar sadece büyük şehirlere satar; muhafızları oyuncu koyar, baskını oyuncu savunur | Şehir → Kervan |
| 30 | Sis: ordular sadece görüş mesafesinde görünür | harita |
| 32, 35, 37 | "Ricat! Ricat!" sesi; seçilebilir nida/tekbir (Allah Allah, Hurra, Ehadun Ehad, kendi nidan) | savaş düğmeleri |
| 33 | Din seçimi, orduda din adamı (iyileştirir) | Komutan |
| 36 | Ulak haritada yolculuk eder, hükümdar okuyup cevap yollar | Ulak |
| 39 | Himayeye girme (ikna), vergi verme, hami ile birlikte savaşma, istenince çıkma/çıkarılma | Diplomasi |

## Not
"Diğer oyuncular" şu an yapay zekâ hükümdarlardır. Gerçek çevrim içi çok oyunculu mod için
bir sunucu gerekir; oyun mantığı (`js/game.js`) buna uygun şekilde ayrık tutulmuştur.
Harita çizim tarzı genel "sevimli gölgeli" stilde yapıldı; kendi çizimlerini paylaşırsan stile uyarlanabilir.
