# Source des traductions -> génère locales/*.json  (python3 scripts/locales_src.py)
import json, os

K = ["offer_banner","nav_houses","him","her","cart","close","lang_title","tagline","legal","terms","privacy","adult",
"w_choose","w_continue","w_age",
"h_eyebrow","h_title","h_sub","nuits_tag","nuits_desc","sens_tag","sens_desc","sens_follow","soon","soon_short",
"offer_kicker","offer_title","offer_text",
"p1_t","p1","p2_t","p2","p3_t","p3","p4_t","p4",
"collection","lui_sub","elle_sub","cat_all","cat_miel","cat_huile","cat_bougie","cat_gel","cat_soin","cat_pack","cat_empty","all_products",
"best_kicker","best","best_sub","packs","packs_sub","packs_empty","demo_note",
"add","added","photo_soon","b_promo","b_new","b_fav","b_best","toast_added",
"cart_empty","cart_more","cart_unlocked","subtotal","free","total","checkout",
"back_lui","back_elle","related","offer_note","ship","ship_v","pack_l","pack_v","pay","pay_v","desc_default","not_found"]

L = {}
L["fr"] = ["Offre de lancement · 3 achetés, le 4ᵉ offert","Nos maisons","Pour lui","Pour elle","Panier","Fermer","Choisissez votre langue","Quand le désir prend la forme de miel","Mentions légales","CGV","Confidentialité","Vente réservée aux personnes majeures. © 2026 OrDesNuits",
"Choisissez votre langue","Continuer en {lang}","En entrant, vous confirmez avoir 18 ans ou plus.",
"Bienvenue chez vous","Deux maisons, <em class=\"gold-text\">un même secret</em>","Choisissez votre univers, puis la boutique qui vous ressemble.","Miels rares & plaisirs de la nuit","Des miels d'exception, des huiles, des bougies et des soins pensés pour les nuits qui comptent.","L'art d'éveiller les sens","Une seconde maison se prépare dans le secret. Elle éveillera tous vos sens.","Être prévenu sur Snapchat","Bientôt","bientôt",
"Offre de lancement","3 achetés, le 4ᵉ offert","Sur tous les produits marqués 3+1. Mélangez les saveurs, la remise s'applique toute seule au panier.",
"Emballage neutre","Aucune mention du contenu sur le colis.","Expédié sous 48 h","Préparé avec soin, envoyé avec suivi.","Votre langue, votre devise","11 langues et des prix affichés dans votre monnaie.","Une question ?","Écrivez-nous sur WhatsApp ou Snapchat, on répond vite.",
"Collection","Intense, ambré, assumé.","Doux, floral, enveloppant.","Tout","Miels","Huiles","Bougies","Gels retardants","Soins intimes","Coffrets","De nouvelles pièces arrivent bientôt dans cette catégorie.","Toute la collection",
"Les préférés","Meilleures ventes","Ce que nos clients choisissent le plus, mis à jour chaque semaine.","Packs","Des coffrets pensés pour offrir, ou pour deux.","Nos coffrets arrivent très bientôt.","Catalogue de démonstration",
"Ajouter","Ajouté","Photo à venir","Promo","Nouveau","Coup de cœur","Best-seller","Ajouté au panier",
"Votre panier attend sa première douceur.","Encore {n} article(s) 3+1 et le suivant est offert","Bravo, {n} article(s) offert(s) !","Sous-total","Offert (3+1)","Total","Commander sur WhatsApp",
"Retour à la boutique Pour lui","Retour à la boutique Pour elle","Vous aimerez aussi","Éligible à l'offre : 3 achetés, le 4ᵉ offert.","Livraison","48 h, suivie","Emballage","Neutre, sans mention","Paiement","Sécurisé","La description de ce produit arrive bientôt.","Ce produit n'est plus disponible."]

L["en"] = ["Launch offer · Buy 3, get the 4th free","Our houses","For him","For her","Cart","Close","Choose your language","When desire takes the shape of honey","Legal notice","Terms of sale","Privacy","Sales restricted to adults. © 2026 OrDesNuits",
"Choose your language","Continue in {lang}","By entering, you confirm you are 18 or older.",
"Welcome","Two houses, <em class=\"gold-text\">one secret</em>","Choose your world, then the boutique that suits you.","Rare honeys & night-time pleasures","Exceptional honeys, oils, candles and care, made for the nights that matter.","The art of awakening the senses","A second house is being prepared in secret. It will awaken every sense.","Get notified on Snapchat","Coming soon","soon",
"Launch offer","Buy 3, get the 4th free","On every product marked 3+1. Mix the flavours, the discount applies automatically in your cart.",
"Plain packaging","Nothing on the parcel reveals what's inside.","Ships within 48 h","Packed with care, sent with tracking.","Your language, your currency","11 languages and prices shown in your currency.","A question?","Message us on WhatsApp or Snapchat, we reply fast.",
"Collection","Intense, amber, unapologetic.","Soft, floral, enveloping.","All","Honeys","Oils","Candles","Delay gels","Intimate care","Gift boxes","New pieces are coming soon in this category.","The full collection",
"Favourites","Best sellers","What our customers choose most, updated every week.","Bundles","Gift boxes made for giving, or for two.","Our gift boxes are coming very soon.","Demo catalogue",
"Add","Added","Photo coming soon","Sale","New","Our pick","Best seller","Added to cart",
"Your cart is waiting for its first treat.","{n} more 3+1 item(s) and the next one is free","Nice, {n} item(s) free!","Subtotal","Free (3+1)","Total","Order on WhatsApp",
"Back to the For him boutique","Back to the For her boutique","You may also like","Part of the offer: buy 3, get the 4th free.","Shipping","48 h, tracked","Packaging","Plain, unmarked","Payment","Secure","This product's description is coming soon.","This product is no longer available."]

L["ar"] = ["عرض الإطلاق · اشترِ 3 والرابع مجانًا","دُورنا","له","لها","السلة","إغلاق","اختر لغتك","حين تتخذ الرغبة شكل العسل","إشعار قانوني","شروط البيع","الخصوصية","البيع للبالغين فقط. © 2026 OrDesNuits",
"اختر لغتك","المتابعة بـ {lang}","بدخولك، تؤكد أن عمرك 18 عامًا أو أكثر.",
"أهلاً بك","داران، <em class=\"gold-text\">وسرٌّ واحد</em>","اختر عالمك، ثم المتجر الذي يشبهك.","عسل نادر ومتع الليل","عسل استثنائي وزيوت وشموع ومستحضرات لليالٍ لا تُنسى.","فنّ إيقاظ الحواس","دار ثانية تُحضَّر في الخفاء، ستوقظ كل حواسك.","تابعنا على سناب شات","قريبًا","قريبًا",
"عرض الإطلاق","اشترِ 3 والرابع مجانًا","على كل المنتجات المميّزة بـ 3+1. امزج النكهات، والخصم يُطبَّق تلقائيًا في السلة.",
"تغليف محايد","لا شيء على الطرد يكشف محتواه.","شحن خلال 48 ساعة","يُحضَّر بعناية ويُرسل مع رقم تتبع.","لغتك وعملتك","11 لغة وأسعار بعملتك.","لديك سؤال؟","راسلنا على واتساب أو سناب شات، نرد بسرعة.",
"المجموعة","قوي، كهرماني، واثق.","ناعم، زهري، دافئ.","الكل","عسل","زيوت","شموع","جل مؤخِّر","عناية حميمة","علب هدايا","قطع جديدة قريبًا في هذه الفئة.","المجموعة الكاملة",
"المفضّلة","الأكثر مبيعًا","ما يختاره عملاؤنا أكثر، يُحدَّث كل أسبوع.","باقات","علب هدايا للإهداء أو لشخصين.","باقاتنا قادمة قريبًا جدًا.","كتالوج تجريبي",
"أضف","أُضيف","الصورة قريبًا","تخفيض","جديد","اختيارنا","الأكثر مبيعًا","أُضيف إلى السلة",
"سلتك تنتظر أول لمسة حلاوة.","أضف {n} من منتجات 3+1 ويصبح التالي مجانيًا","رائع، {n} منتج مجانًا!","المجموع الفرعي","مجاني (3+1)","الإجمالي","اطلب عبر واتساب",
"العودة إلى متجر «له»","العودة إلى متجر «لها»","قد يعجبك أيضًا","مشمول بالعرض: اشترِ 3 والرابع مجانًا.","الشحن","48 ساعة مع تتبع","التغليف","محايد بلا علامات","الدفع","آمن","وصف هذا المنتج قريبًا.","هذا المنتج لم يعد متوفرًا."]

L["es"] = ["Oferta de lanzamiento · Compra 3 y el 4.º es gratis","Nuestras casas","Para él","Para ella","Carrito","Cerrar","Elige tu idioma","Cuando el deseo toma la forma de miel","Aviso legal","Condiciones de venta","Privacidad","Venta reservada a mayores de edad. © 2026 OrDesNuits",
"Elige tu idioma","Continuar en {lang}","Al entrar, confirmas que tienes 18 años o más.",
"Bienvenido","Dos casas, <em class=\"gold-text\">un mismo secreto</em>","Elige tu universo y luego la tienda que va contigo.","Mieles raras y placeres de la noche","Mieles excepcionales, aceites, velas y cuidados pensados para las noches que importan.","El arte de despertar los sentidos","Una segunda casa se prepara en secreto. Despertará todos tus sentidos.","Avísame por Snapchat","Próximamente","pronto",
"Oferta de lanzamiento","Compra 3 y el 4.º es gratis","En todos los productos marcados 3+1. Mezcla sabores, el descuento se aplica solo en el carrito.",
"Embalaje neutro","Nada en el paquete revela su contenido.","Enviado en 48 h","Preparado con cuidado, enviado con seguimiento.","Tu idioma, tu moneda","11 idiomas y precios en tu moneda.","¿Alguna pregunta?","Escríbenos por WhatsApp o Snapchat, respondemos rápido.",
"Colección","Intenso, ámbar, sin complejos.","Suave, floral, envolvente.","Todo","Mieles","Aceites","Velas","Geles retardantes","Cuidado íntimo","Cofres","Pronto llegarán nuevas piezas a esta categoría.","Toda la colección",
"Favoritos","Más vendidos","Lo que más eligen nuestros clientes, actualizado cada semana.","Packs","Cofres pensados para regalar, o para dos.","Nuestros cofres llegan muy pronto.","Catálogo de demostración",
"Añadir","Añadido","Foto próximamente","Oferta","Nuevo","Favorito","Más vendido","Añadido al carrito",
"Tu carrito espera su primer capricho.","{n} artículo(s) 3+1 más y el siguiente es gratis","¡Genial, {n} artículo(s) gratis!","Subtotal","Gratis (3+1)","Total","Pedir por WhatsApp",
"Volver a la tienda Para él","Volver a la tienda Para ella","También te gustará","Incluido en la oferta: compra 3 y el 4.º es gratis.","Envío","48 h, con seguimiento","Embalaje","Neutro, sin marcas","Pago","Seguro","La descripción de este producto llega pronto.","Este producto ya no está disponible."]

L["pt"] = ["Oferta de lançamento · Compre 3 e leve o 4.º grátis","Nossas casas","Para ele","Para ela","Carrinho","Fechar","Escolha seu idioma","Quando o desejo ganha a forma do mel","Aviso legal","Condições de venda","Privacidade","Venda restrita a maiores de idade. © 2026 OrDesNuits",
"Escolha seu idioma","Continuar em {lang}","Ao entrar, você confirma ter 18 anos ou mais.",
"Bem-vindo","Duas casas, <em class=\"gold-text\">um mesmo segredo</em>","Escolha seu universo e depois a loja que combina com você.","Méis raros e prazeres da noite","Méis excepcionais, óleos, velas e cuidados pensados para as noites que importam.","A arte de despertar os sentidos","Uma segunda casa está sendo preparada em segredo. Ela vai despertar todos os seus sentidos.","Avise-me pelo Snapchat","Em breve","em breve",
"Oferta de lançamento","Compre 3 e leve o 4.º grátis","Em todos os produtos marcados 3+1. Misture os sabores, o desconto é aplicado sozinho no carrinho.",
"Embalagem neutra","Nada no pacote revela o conteúdo.","Enviado em 48 h","Preparado com cuidado, enviado com rastreio.","Seu idioma, sua moeda","11 idiomas e preços na sua moeda.","Alguma dúvida?","Fale conosco no WhatsApp ou Snapchat, respondemos rápido.",
"Coleção","Intenso, âmbar, sem rodeios.","Suave, floral, envolvente.","Tudo","Méis","Óleos","Velas","Géis retardantes","Cuidado íntimo","Kits","Novas peças chegam em breve nesta categoria.","Toda a coleção",
"Favoritos","Mais vendidos","O que nossos clientes mais escolhem, atualizado toda semana.","Kits","Kits pensados para presentear, ou para dois.","Nossos kits chegam muito em breve.","Catálogo de demonstração",
"Adicionar","Adicionado","Foto em breve","Promoção","Novo","Favorito","Mais vendido","Adicionado ao carrinho",
"Seu carrinho espera o primeiro mimo.","Mais {n} item(ns) 3+1 e o próximo é grátis","Boa, {n} item(ns) grátis!","Subtotal","Grátis (3+1)","Total","Pedir pelo WhatsApp",
"Voltar à loja Para ele","Voltar à loja Para ela","Você também vai gostar","Faz parte da oferta: compre 3 e leve o 4.º grátis.","Envio","48 h, rastreado","Embalagem","Neutra, sem marcas","Pagamento","Seguro","A descrição deste produto chega em breve.","Este produto não está mais disponível."]

L["ru"] = ["Стартовая акция · 3 покупаете, 4-й в подарок","Наши дома","Для него","Для неё","Корзина","Закрыть","Выберите язык","Когда желание принимает форму мёда","Правовая информация","Условия продажи","Конфиденциальность","Продажа только совершеннолетним. © 2026 OrDesNuits",
"Выберите язык","Продолжить: {lang}","Входя на сайт, вы подтверждаете, что вам 18 лет или больше.",
"Добро пожаловать","Два дома, <em class=\"gold-text\">одна тайна</em>","Выберите свой мир, а затем бутик, который вам ближе.","Редкий мёд и ночные удовольствия","Исключительный мёд, масла, свечи и уход для особенных ночей.","Искусство пробуждать чувства","Второй дом готовится в тайне. Он пробудит все ваши чувства.","Узнать первым в Snapchat","Скоро","скоро",
"Стартовая акция","3 покупаете, 4-й в подарок","На все товары с отметкой 3+1. Сочетайте вкусы, скидка применяется в корзине автоматически.",
"Нейтральная упаковка","На посылке нет ничего о содержимом.","Отправка за 48 ч","Бережно упаковано, отправлено с трекингом.","Ваш язык, ваша валюта","11 языков и цены в вашей валюте.","Есть вопрос?","Пишите в WhatsApp или Snapchat, отвечаем быстро.",
"Коллекция","Насыщенный, янтарный, смелый.","Нежный, цветочный, обволакивающий.","Все","Мёд","Масла","Свечи","Гели-пролонгаторы","Интимный уход","Наборы","Скоро в этой категории появятся новинки.","Вся коллекция",
"Любимое","Хиты продаж","То, что клиенты выбирают чаще всего. Обновляется каждую неделю.","Наборы","Наборы в подарок или для двоих.","Наборы появятся совсем скоро.","Демо-каталог",
"В корзину","Добавлено","Фото скоро","Скидка","Новинка","Наш выбор","Хит","Добавлено в корзину",
"Ваша корзина ждёт первую сладость.","Ещё {n} товар(а) 3+1, и следующий в подарок","Отлично, {n} товар(а) в подарок!","Подытог","Подарок (3+1)","Итого","Заказать в WhatsApp",
"Назад в бутик «Для него»","Назад в бутик «Для неё»","Вам также понравится","Участвует в акции: 3 покупаете, 4-й в подарок.","Доставка","48 ч, с трекингом","Упаковка","Нейтральная, без надписей","Оплата","Безопасная","Описание товара скоро появится.","Этот товар больше недоступен."]

L["de"] = ["Einführungsangebot · 3 kaufen, das 4. gratis","Unsere Häuser","Für ihn","Für sie","Warenkorb","Schließen","Sprache wählen","Wenn Verlangen die Form von Honig annimmt","Impressum","AGB","Datenschutz","Verkauf nur an Volljährige. © 2026 OrDesNuits",
"Sprache wählen","Weiter auf {lang}","Mit dem Betreten bestätigst du, dass du mindestens 18 Jahre alt bist.",
"Willkommen","Zwei Häuser, <em class=\"gold-text\">ein Geheimnis</em>","Wähle deine Welt und dann die Boutique, die zu dir passt.","Seltene Honige & Genüsse der Nacht","Außergewöhnliche Honige, Öle, Kerzen und Pflege für Nächte, die zählen.","Die Kunst, die Sinne zu wecken","Ein zweites Haus entsteht im Verborgenen. Es wird all deine Sinne wecken.","Auf Snapchat benachrichtigt werden","Demnächst","bald",
"Einführungsangebot","3 kaufen, das 4. gratis","Auf alle Produkte mit 3+1-Markierung. Sorten mischen, der Rabatt wird im Warenkorb automatisch abgezogen.",
"Neutrale Verpackung","Nichts auf dem Paket verrät den Inhalt.","Versand in 48 Std.","Sorgfältig verpackt, mit Sendungsverfolgung.","Deine Sprache, deine Währung","11 Sprachen und Preise in deiner Währung.","Eine Frage?","Schreib uns auf WhatsApp oder Snapchat, wir antworten schnell.",
"Kollektion","Intensiv, bernsteinfarben, selbstbewusst.","Sanft, blumig, umhüllend.","Alle","Honige","Öle","Kerzen","Verzögerungsgele","Intimpflege","Geschenksets","Bald gibt es neue Stücke in dieser Kategorie.","Die ganze Kollektion",
"Lieblinge","Bestseller","Was unsere Kunden am häufigsten wählen, jede Woche aktualisiert.","Sets","Sets zum Verschenken oder für zwei.","Unsere Sets kommen sehr bald.","Demo-Katalog",
"Hinzufügen","Hinzugefügt","Foto folgt","Angebot","Neu","Unser Tipp","Bestseller","Zum Warenkorb hinzugefügt",
"Dein Warenkorb wartet auf die erste Süße.","Noch {n} 3+1-Artikel und der nächste ist gratis","Super, {n} Artikel gratis!","Zwischensumme","Gratis (3+1)","Gesamt","Über WhatsApp bestellen",
"Zurück zur Boutique Für ihn","Zurück zur Boutique Für sie","Das könnte dir auch gefallen","Teil des Angebots: 3 kaufen, das 4. gratis.","Versand","48 Std., mit Tracking","Verpackung","Neutral, ohne Aufdruck","Zahlung","Sicher","Die Beschreibung dieses Produkts folgt bald.","Dieses Produkt ist nicht mehr verfügbar."]

L["zh"] = ["新品上市优惠 · 买3送1","我们的品牌馆","男士专享","女士专享","购物车","关闭","选择语言","当欲望化作蜂蜜","法律声明","销售条款","隐私","仅向成年人销售。© 2026 OrDesNuits",
"选择语言","以{lang}继续","进入即表示您已年满18岁。",
"欢迎光临","两座品牌馆，<em class=\"gold-text\">同一个秘密</em>","选择您的世界，再选择适合您的精品店。","珍稀蜂蜜与夜之愉悦","非凡蜂蜜、精油、香烛与护理，为重要的夜晚而生。","唤醒感官的艺术","第二座品牌馆正在悄然筹备，它将唤醒您的所有感官。","在 Snapchat 上获取通知","即将推出","即将推出",
"新品上市优惠","买3送1","适用于所有标有3+1的商品。可自由混搭，购物车自动减免。",
"中性包装","包裹上不显示任何内容信息。","48小时内发货","精心包装，可追踪配送。","您的语言，您的货币","11种语言，以您的货币显示价格。","有疑问？","通过 WhatsApp 或 Snapchat 联系我们，回复迅速。",
"系列","浓烈、琥珀、坦然。","柔和、花香、包裹感。","全部","蜂蜜","精油","香烛","延时凝胶","私密护理","礼盒","此类别即将上新。","全部系列",
"人气之选","畅销榜","顾客最常选择的商品，每周更新。","套装","适合赠礼或两人共享的礼盒。","礼盒即将上线。","演示目录",
"加入","已加入","图片即将上线","促销","新品","店长推荐","畅销","已加入购物车",
"您的购物车正等待第一份甜蜜。","再加 {n} 件3+1商品，下一件免费","太好了，赠送 {n} 件！","小计","赠送 (3+1)","合计","通过 WhatsApp 下单",
"返回男士专享","返回女士专享","你可能还喜欢","参与优惠：买3送1。","配送","48小时，可追踪","包装","中性无标识","支付","安全","商品描述即将上线。","该商品已下架。"]

L["ja"] = ["ローンチ記念 · 3つ買うと4つ目が無料","メゾン","彼へ","彼女へ","カート","閉じる","言語を選択","欲望がはちみつになるとき","法的表示","販売条件","プライバシー","成人のみ販売。© 2026 OrDesNuits",
"言語を選択","{lang}で続ける","入場すると、18歳以上であることを確認したことになります。",
"ようこそ","ふたつのメゾン、<em class=\"gold-text\">ひとつの秘密</em>","世界観を選び、あなたに合うブティックへ。","希少なはちみつと夜の悦び","特別な夜のための、極上のはちみつ、オイル、キャンドル、ケア。","五感を目覚めさせる芸術","第二のメゾンが密かに準備中。あなたのすべての感覚を目覚めさせます。","Snapchatでお知らせを受け取る","近日公開","近日",
"ローンチ記念","3つ買うと4つ目が無料","3+1マークの付いた全商品が対象。組み合わせ自由、カートで自動的に割引されます。",
"無地の梱包","荷物に中身の記載は一切ありません。","48時間以内に発送","丁寧に梱包し、追跡付きでお届け。","あなたの言語と通貨で","11言語、価格はあなたの通貨で表示。","ご質問は？","WhatsApp か Snapchat でどうぞ。すぐにお返事します。",
"コレクション","濃厚、琥珀色、大胆。","やさしく、華やかに、包み込む。","すべて","はちみつ","オイル","キャンドル","ディレイジェル","インティメイトケア","ギフトセット","このカテゴリーには近日新作が登場します。","全コレクション",
"人気","ベストセラー","お客様に最も選ばれているアイテム。毎週更新。","セット","贈り物に、ふたりのためのギフトセット。","ギフトセットはまもなく登場します。","デモカタログ",
"追加","追加済み","写真は近日公開","セール","新作","おすすめ","人気No.1","カートに追加しました",
"カートは最初の甘いひとつを待っています。","3+1対象をあと{n}点で次の1点が無料","{n}点が無料になりました！","小計","無料 (3+1)","合計","WhatsAppで注文",
"「彼へ」に戻る","「彼女へ」に戻る","こちらもおすすめ","対象商品：3つ買うと4つ目が無料。","配送","48時間・追跡付き","梱包","無地・表記なし","お支払い","安全","商品説明は近日公開予定です。","この商品は現在お取り扱いがありません。"]

L["ko"] = ["런칭 특가 · 3개 사면 4번째 무료","우리의 메종","그를 위해","그녀를 위해","장바구니","닫기","언어 선택","욕망이 꿀의 모습이 될 때","법적 고지","판매 약관","개인정보","성인에게만 판매합니다. © 2026 OrDesNuits",
"언어 선택","{lang}(으)로 계속","입장하면 만 18세 이상임을 확인하는 것입니다.",
"환영합니다","두 개의 메종, <em class=\"gold-text\">하나의 비밀</em>","당신의 세계를 고르고, 어울리는 부티크로 들어오세요.","희귀한 꿀과 밤의 즐거움","특별한 밤을 위한 최고급 꿀, 오일, 캔들, 케어.","감각을 깨우는 예술","두 번째 메종이 비밀리에 준비 중입니다. 당신의 모든 감각을 깨울 거예요.","Snapchat으로 소식 받기","곧 공개","곧",
"런칭 특가","3개 사면 4번째 무료","3+1 표시 제품 전체에 적용. 자유롭게 섞어도 장바구니에서 자동 할인됩니다.",
"무지 포장","택배 겉면에 내용물 표시가 없습니다.","48시간 내 발송","정성껏 포장해 추적 번호와 함께 보냅니다.","당신의 언어, 당신의 통화","11개 언어, 가격은 당신의 통화로.","궁금한 점이 있나요?","WhatsApp 또는 Snapchat으로 문의하세요. 빠르게 답합니다.",
"컬렉션","강렬하고, 호박빛으로, 당당하게.","부드럽고, 꽃향기로, 감싸듯이.","전체","꿀","오일","캔들","지연 젤","이너 케어","기프트 세트","이 카테고리에 곧 새로운 제품이 들어옵니다.","전체 컬렉션",
"인기","베스트셀러","고객이 가장 많이 고른 제품, 매주 업데이트.","세트","선물용 또는 둘을 위한 기프트 세트.","세트 상품이 곧 찾아옵니다.","데모 카탈로그",
"담기","담김","사진 준비 중","세일","신상품","추천","베스트","장바구니에 담았습니다",
"장바구니가 첫 달콤함을 기다리고 있어요.","3+1 제품 {n}개만 더 담으면 다음 하나는 무료","좋아요, {n}개 무료!","소계","무료 (3+1)","합계","WhatsApp으로 주문",
"‘그를 위해’로 돌아가기","‘그녀를 위해’로 돌아가기","함께 보면 좋은 제품","혜택 대상: 3개 사면 4번째 무료.","배송","48시간, 추적 가능","포장","무지, 표시 없음","결제","안전","제품 설명이 곧 업데이트됩니다.","이 제품은 더 이상 판매하지 않습니다."]

# ---------- Concierge ----------
K2 = ["chat_title","chat_status","chat_hello","chat_placeholder","chat_send","chat_send_wa","chat_fallback","chat_human",
"q_ship","a_ship","q_discreet","a_discreet","q_offer","a_offer","q_order","a_order","q_pay","a_pay"]
L2 = {}
L2["fr"] = ["Le Concierge","En ligne · répond aussitôt","Bienvenue chez OrDesNuits. Je suis votre concierge : que puis-je faire pour vous ?","Écrivez votre question…","Envoyer","Envoyer à l'équipe sur WhatsApp","Pour cette question, notre équipe vous répondra personnellement. Votre message est prêt à partir :","Parler à quelqu'un",
"Délais de livraison ?","Les commandes sont expédiées sous 48 h, avec suivi. À l'international, le délai dépend du pays de livraison.","Le colis est-il discret ?","Oui. Emballage neutre, aucune mention du contenu ni de la marque sur le colis.","Comment marche l'offre 3+1 ?","Pour 4 articles marqués 3+1 dans votre panier, le moins cher vous est offert. La remise s'applique toute seule.","Comment commander ?","Ajoutez vos produits au panier, puis touchez « Commander sur WhatsApp » : votre commande nous arrive déjà rédigée.","Moyens de paiement ?","Pour l'instant, nous finalisons le paiement avec vous sur WhatsApp. Le paiement par carte en ligne arrive bientôt."]
L2["en"] = ["The Concierge","Online · replies instantly","Welcome to OrDesNuits. I'm your concierge: how may I help you?","Type your question…","Send","Send to the team on WhatsApp","Our team will answer this one personally. Your message is ready to go:","Talk to someone",
"Delivery times?","Orders ship within 48 h, with tracking. For international orders, timing depends on the destination country.","Is the parcel discreet?","Yes. Plain packaging, with no mention of the contents or the brand on the parcel.","How does the 3+1 offer work?","For every 4 items marked 3+1 in your cart, the cheapest one is free. The discount applies automatically.","How do I order?","Add your products to the cart, then tap “Order on WhatsApp”: your order reaches us already written.","Payment methods?","For now, we finalise payment with you on WhatsApp. Online card payment is coming soon."]
L2["ar"] = ["الكونسيرج","متصل · يرد فورًا","أهلاً بك في OrDesNuits. أنا الكونسيرج الخاص بك: كيف يمكنني مساعدتك؟","اكتب سؤالك…","إرسال","أرسل إلى الفريق عبر واتساب","سيجيبك فريقنا شخصيًا على هذا السؤال. رسالتك جاهزة للإرسال:","تحدّث مع شخص",
"مدة التوصيل؟","تُشحن الطلبات خلال 48 ساعة مع رقم تتبع. للطلبات الدولية، تختلف المدة حسب بلد التوصيل.","هل الطرد سري؟","نعم. تغليف محايد، دون أي إشارة إلى المحتوى أو العلامة على الطرد.","كيف يعمل عرض 3+1؟","لكل 4 منتجات مميّزة بـ 3+1 في سلتك، يكون الأرخص مجانيًا. يُطبَّق الخصم تلقائيًا.","كيف أطلب؟","أضف منتجاتك إلى السلة ثم اضغط «اطلب عبر واتساب»: يصلنا طلبك مكتوبًا جاهزًا.","طرق الدفع؟","حاليًا نُتمّ الدفع معك عبر واتساب. الدفع بالبطاقة عبر الإنترنت قريبًا."]
L2["es"] = ["El Conserje","En línea · responde al instante","Bienvenido a OrDesNuits. Soy su conserje: ¿en qué puedo ayudarle?","Escribe tu pregunta…","Enviar","Enviar al equipo por WhatsApp","Nuestro equipo responderá personalmente a esta pregunta. Tu mensaje está listo para enviar:","Hablar con alguien",
"¿Plazos de entrega?","Los pedidos se envían en 48 h, con seguimiento. Para envíos internacionales, el plazo depende del país.","¿El paquete es discreto?","Sí. Embalaje neutro, sin mención del contenido ni de la marca en el paquete.","¿Cómo funciona la oferta 3+1?","Por cada 4 artículos marcados 3+1 en tu carrito, el más barato es gratis. El descuento se aplica solo.","¿Cómo hago un pedido?","Añade tus productos al carrito y toca «Pedir por WhatsApp»: tu pedido nos llega ya redactado.","¿Formas de pago?","Por ahora, finalizamos el pago contigo por WhatsApp. El pago con tarjeta en línea llega pronto."]
L2["pt"] = ["O Concierge","Online · responde na hora","Bem-vindo à OrDesNuits. Sou o seu concierge: como posso ajudar?","Escreva sua pergunta…","Enviar","Enviar para a equipe no WhatsApp","Nossa equipe vai responder pessoalmente a esta pergunta. Sua mensagem está pronta:","Falar com alguém",
"Prazos de entrega?","Os pedidos são enviados em 48 h, com rastreio. Para envios internacionais, o prazo depende do país.","A embalagem é discreta?","Sim. Embalagem neutra, sem menção ao conteúdo nem à marca no pacote.","Como funciona a oferta 3+1?","A cada 4 itens marcados 3+1 no carrinho, o mais barato sai grátis. O desconto é automático.","Como faço um pedido?","Adicione os produtos ao carrinho e toque em «Pedir pelo WhatsApp»: seu pedido chega até nós já escrito.","Formas de pagamento?","Por enquanto, finalizamos o pagamento com você pelo WhatsApp. O pagamento com cartão online chega em breve."]
L2["ru"] = ["Консьерж","В сети · отвечает сразу","Добро пожаловать в OrDesNuits. Я ваш консьерж: чем могу помочь?","Напишите вопрос…","Отправить","Отправить команде в WhatsApp","На этот вопрос наша команда ответит лично. Ваше сообщение готово к отправке:","Связаться с человеком",
"Сроки доставки?","Заказы отправляются в течение 48 ч с трекингом. Сроки международной доставки зависят от страны.","Посылка неприметная?","Да. Нейтральная упаковка, на посылке нет ни содержимого, ни названия бренда.","Как работает акция 3+1?","На каждые 4 товара с отметкой 3+1 в корзине самый дешёвый — в подарок. Скидка применяется автоматически.","Как оформить заказ?","Добавьте товары в корзину и нажмите «Заказать в WhatsApp»: заказ придёт к нам уже составленным.","Способы оплаты?","Пока мы завершаем оплату с вами в WhatsApp. Онлайн-оплата картой появится скоро."]
L2["de"] = ["Der Concierge","Online · antwortet sofort","Willkommen bei OrDesNuits. Ich bin dein Concierge: Wie kann ich helfen?","Schreib deine Frage…","Senden","An das Team auf WhatsApp senden","Diese Frage beantwortet unser Team persönlich. Deine Nachricht ist bereit:","Mit jemandem sprechen",
"Lieferzeiten?","Bestellungen werden innerhalb von 48 Std. mit Sendungsverfolgung verschickt. International hängt die Dauer vom Zielland ab.","Ist das Paket diskret?","Ja. Neutrale Verpackung, ohne Hinweis auf Inhalt oder Marke.","Wie funktioniert 3+1?","Für je 4 Artikel mit 3+1-Markierung im Warenkorb ist der günstigste gratis. Der Rabatt wird automatisch abgezogen.","Wie bestelle ich?","Leg deine Produkte in den Warenkorb und tippe auf „Über WhatsApp bestellen“: Deine Bestellung kommt fertig formuliert bei uns an.","Zahlungsarten?","Derzeit schließen wir die Zahlung mit dir über WhatsApp ab. Online-Kartenzahlung kommt bald."]
L2["zh"] = ["礼宾助手","在线 · 即时回复","欢迎来到 OrDesNuits。我是您的礼宾助手，有什么可以为您效劳？","输入您的问题…","发送","通过 WhatsApp 发送给团队","这个问题将由我们的团队亲自回复。您的消息已准备好：","联系客服",
"配送时间？","订单在48小时内发出，可追踪。国际订单的时效取决于目的地国家。","包裹是否隐秘？","是的。中性包装，包裹上不显示内容或品牌。","3+1 优惠怎么用？","购物车中每有4件标有3+1的商品，最便宜的一件免费，自动减免。","如何下单？","将商品加入购物车，然后点击“通过 WhatsApp 下单”，订单会自动写好发给我们。","支付方式？","目前我们通过 WhatsApp 与您完成付款。在线刷卡支付即将上线。"]
L2["ja"] = ["コンシェルジュ","オンライン · すぐに返信","OrDesNuits へようこそ。コンシェルジュです。ご用件をお聞かせください。","ご質問を入力…","送信","WhatsAppでチームに送る","このご質問にはスタッフが直接お答えします。メッセージの準備ができました：","スタッフと話す",
"配送日数は？","ご注文は48時間以内に追跡付きで発送します。海外配送の日数はお届け先の国によります。","梱包は目立ちませんか？","はい。無地の梱包で、中身やブランド名の記載は一切ありません。","3+1特典の仕組みは？","カート内の3+1対象商品4点ごとに、最も安い1点が無料になります。割引は自動です。","注文方法は？","商品をカートに入れて「WhatsAppで注文」を押すだけ。注文内容が入力済みで届きます。","お支払い方法は？","現在はWhatsAppでお支払いを確定しています。オンラインのカード決済はまもなく対応予定です。"]
L2["ko"] = ["컨시어지","온라인 · 즉시 응답","OrDesNuits에 오신 것을 환영합니다. 컨시어지입니다. 무엇을 도와드릴까요?","질문을 입력하세요…","보내기","WhatsApp으로 팀에 보내기","이 질문은 저희 팀이 직접 답변드립니다. 메시지가 준비되었습니다:","직원과 대화하기",
"배송 기간은?","주문은 48시간 내에 추적 번호와 함께 발송됩니다. 해외 배송 기간은 국가에 따라 다릅니다.","포장이 티 나지 않나요?","네. 무지 포장이며 내용물이나 브랜드 표시가 없습니다.","3+1 혜택은 어떻게 되나요?","장바구니에 3+1 표시 제품이 4개 담길 때마다 가장 저렴한 1개가 무료입니다. 자동 적용됩니다.","주문 방법은?","제품을 장바구니에 담고 「WhatsApp으로 주문」을 누르세요. 주문 내용이 작성된 채로 전달됩니다.","결제 수단은?","현재는 WhatsApp에서 결제를 마무리합니다. 온라인 카드 결제는 곧 지원됩니다."]
for c in L2:
    assert len(L2[c]) == len(K2), (c, len(L2[c]))
    L[c] = L[c] + L2[c]
K = K + K2

os.makedirs("locales", exist_ok=True)
for code, vals in L.items():
    assert len(vals) == len(K), (code, len(vals), len(K))
    with open(f"locales/{code}.json", "w", encoding="utf-8") as f:
        json.dump(dict(zip(K, vals)), f, ensure_ascii=False, indent=1)
print("ok", len(K), "clés ×", len(L), "langues")
