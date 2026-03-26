// ==========================================
// StepBy - i18n 翻訳システム
// ==========================================

const UI1_TRANSLATIONS = {
    ja: {}, // デフォルト（日本語はそのまま）
    en: {
        // ナビゲーション
        'マップ': 'Map',
        'みんなの投稿': 'All Posts',
        'MY': 'MY',

        // ページタイトル
        'StepBy — バリアフリー地図': 'StepBy — Barrier-Free Map',
        '道情報の詳細': 'Road Info Details',
        '道情報の投稿': 'Post Road Info',
        'プロフィール': 'Profile',
        'プロフィール編集': 'Edit Profile',
        '自分の投稿履歴': 'My Posts',
        '言語設定': 'Language Settings',
        '表示設定': 'Display Settings',

        // ボタン・ラベル
        'コメントを追加': 'Add Comment',
        '投稿する': 'Post',
        '変更を保存': 'Save Changes',
        '戻る': 'Back',
        '道情報を削除': 'Delete',
        '投稿': 'New Post',
        'タグ': 'Tags',
        '場所': 'Location',
        '画像アップロード': 'Upload Photos',
        '一言メモ': 'Memo',
        '地図上の位置': 'Map Location',
        'ライブラリ': 'Library',
        'カメラ': 'Camera',
        '投稿はまだありません。': 'No posts yet.',

        // 設定ページ
        'ダーク': 'Dark',
        'ライト': 'Light',
        '端末設定に従う': 'System Default',
        'OSの設定を使用': 'Use OS setting',
        '文字サイズ': 'Font Size',
        '小': 'Small',
        '中': 'Medium',
        '大': 'Large',
        'コンパクト表示': 'Compact',
        '標準サイズ（推奨）': 'Standard (recommended)',
        '見やすい大きな文字': 'Large text',
        '📖 プレビュー': '📖 Preview',

        // プロフィール
        'プロフィールを編集': 'Edit Profile',
        '自分の投稿': 'My Posts',
        'PRO限定': 'PRO only',
        'PROアカウント限定': 'PRO accounts only',
        'PROアカウントのみ書き込みできます': 'Only PRO accounts can write',
        '🔒 PROアカウント限定': '🔒 PRO accounts only',
        'PROアカウント限定': 'PRO only',

        // 設定ドロップダウン
        '表示設定': 'Display',
        '地図の設定': 'Map Settings',
        'ヘルプ': 'Help',

        // その他
        '保存しました！': 'Saved!',
        'タグ、本文、画像のいずれかを入力してください。': 'Please enter a tag, text, or image.',
    },
    hi: {
        // ナビゲーション
        'マップ': 'मानचित्र',
        'みんなの投稿': 'सभी पोस्ट',
        'MY': 'मेरा',

        // ボタン
        'コメントを追加': 'टिप्पणी जोड़ें',
        '投稿する': 'पोस्ट करें',
        '変更を保存': 'सहेजें',
        '戻る': 'वापस',
        '投稿': 'पोस्ट',
        'タグ': 'टैग',
        '場所': 'स्थान',
        '一言メモ': 'नोट',
    }
};

// 翻訳を適用する関数
function applyTranslations(lang) {
    if (lang === 'ja' || !UI1_TRANSLATIONS[lang]) return;
    const dict = UI1_TRANSLATIONS[lang];

    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const trimmed = node.textContent.trim();
            if (trimmed && dict[trimmed]) {
                node.textContent = node.textContent.replace(trimmed, dict[trimmed]);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // placeholder属性の翻訳
            if (node.placeholder && dict[node.placeholder]) {
                node.placeholder = dict[node.placeholder];
            }
            // title属性の翻訳
            if (node.title && dict[node.title]) {
                node.title = dict[node.title];
            }
            Array.from(node.childNodes).forEach(translateNode);
        }
    }

    translateNode(document.body);

    // ページタイトルの翻訳
    if (document.title && dict[document.title]) {
        document.title = dict[document.title];
    }
}

// 即時実行（DOMContentLoaded後）
document.addEventListener('DOMContentLoaded', function() {
    const lang = localStorage.getItem('UI1_language') || 'ja';
    applyTranslations(lang);
});
