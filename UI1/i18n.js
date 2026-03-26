// ==========================================
// StepBy - i18n 翻訳システム
// ==========================================

const UI1_TRANSLATIONS = {
    ja: {}, // デフォルト（日本語はそのまま）
    en: {
        // ログインページ
        'バリアフリーの地図をみんなで作ろう': 'Build a barrier-free map together',
        'バリアフリーの地図を': 'Build a barrier-free',
        'みんなで作ろう': 'map together',
        '地図を確認': 'View Map',
        '点字ブロック記録': 'Record Tactile',
        '道情報を投稿': 'Post Info',
        'アカウントでログインしてください': 'Please sign in to continue',
        'Googleでログイン': 'Sign in with Google',
        'ゲストとして使う場合': 'Continue as Guest',
        'ログインせずに地図を見る': 'View map without signing in',
        'ログインすることで': 'By signing in you agree',
        '利用規約': 'Terms',
        'プライバシーポリシー': 'Privacy Policy',
        'に同意したことになります': '',

        // ナビゲーション（下部メニュー）
        'マップ': 'Map',
        'みんなの投稿': 'All Posts',
        '投稿': 'Post',
        'MY': 'MY',

        // プロフィールページ メニュー
        '自分の投稿履歴': 'My Post History',
        '過去の投稿の確認・編集・削除': 'View, edit or delete past posts',
        'プロフィール編集': 'Edit Profile',
        '名前・アイコン・性別の変更': 'Change name, icon & gender',
        '言語設定': 'Language Settings',
        '日本語・English・हिंदी': 'Japanese・English・Hindi',
        '表示設定': 'Display Settings',
        'テーマ・文字サイズ': 'Theme & font size',
        'ヘルプ': 'Help',
        '使い方・よくある質問': 'How to use & FAQ',
        'ログアウト': 'Sign Out',
        'アカウントからサインアウト': 'Sign out of account',

        // プロフィール統計
        '総点字ブロック記録': 'Tactile Records',
        '総道情報投稿': 'Road Posts',
        '送られたハート': 'Hearts',
        'フォロワー': 'Followers',
        'フォロー中': 'Following',
        '投稿数': 'Posts',

        // プロフィール情報
        'ユーザー名': 'Username',
        '生年月日': 'Date of Birth',
        '非公開': 'Private',
        '性別': 'Gender',
        '女性': 'Female',
        '男性': 'Male',
        'その他': 'Other',
        'プロフィールを編集': 'Edit Profile',
        '自分の投稿': 'My Posts',

        // ページタイトル
        '道情報の詳細': 'Road Info',
        '道情報の投稿': 'Post Road Info',
        'プロフィール': 'Profile',

        // ボタン・ラベル共通
        'コメントを追加': 'Add Comment',
        '投稿する': 'Submit Post',
        '変更を保存': 'Save Changes',
        '戻る': 'Back',
        '道情報を削除': 'Delete',
        'タグ': 'Tags',
        '場所': 'Location',
        '画像アップロード': 'Upload Photos',
        '一言メモ': 'Memo',
        '地図上の位置': 'Map Location',
        'ライブラリ': 'Library',
        'カメラ': 'Camera',
        '投稿はまだありません。': 'No posts yet.',
        '地図の設定': 'Map Settings',

        // 表示設定ページ
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

        // PRO関連
        'PRO限定': 'PRO only',
        'PROアカウントのみ書き込みできます': 'PRO accounts only',

        // フィードバック
        '保存しました！': 'Saved!',
        'タグ、本文、画像のいずれかを入力してください。': 'Please add a tag, text, or image.',
    },
    hi: {
        // ナビゲーション
        'マップ': 'मानचित्र',
        'みんなの投稿': 'सभी पोस्ट',
        '投稿': 'पोस्ट',
        'MY': 'मेरा',

        // プロフィール
        '自分の投稿履歴': 'मेरी पोस्ट',
        'プロフィール編集': 'प्रोफ़ाइल संपादित करें',
        '言語設定': 'भाषा सेटिंग',
        '表示設定': 'प्रदर्शन सेटिंग',
        'ヘルプ': 'सहायता',
        'ログアウト': 'साइन आउट',

        // ボタン
        'コメントを追加': 'टिप्पणी जोड़ें',
        '投稿する': 'पोस्ट करें',
        '変更を保存': 'सहेजें',
        '戻る': 'वापस',
        'タグ': 'टैग',
        '場所': 'स्थान',
        '一言メモ': 'नोट',
        'Googleでログイン': 'Google से साइन इन',
        'ログインせずに地図を見る': 'बिना साइन इन के मानचित्र देखें',
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
            if (node.placeholder && dict[node.placeholder]) {
                node.placeholder = dict[node.placeholder];
            }
            Array.from(node.childNodes).forEach(translateNode);
        }
    }

    translateNode(document.body);
}

// 即時実行（DOMContentLoaded後）
document.addEventListener('DOMContentLoaded', function() {
    const lang = localStorage.getItem('UI1_language') || 'ja';
    applyTranslations(lang);
});
