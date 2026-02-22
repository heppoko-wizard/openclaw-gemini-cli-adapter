import { loadSettings } from '../node_modules/@google/gemini-cli/dist/src/config/settings.js';
import { loadCliConfig } from '../node_modules/@google/gemini-cli/dist/src/config/config.js';
import { validateNonInteractiveAuth } from '../node_modules/@google/gemini-cli/dist/src/validateNonInterActiveAuth.js';
import { promptIdContext } from '../node_modules/@google/gemini-cli-core/dist/index.js';

let _geminiClient = null;
let _config = null;
let _isInitialized = false;

/**
 * Gemini CLI のコアモジュールを初期化し、メモリに常駐させます。
 * 起動時に1度だけ呼ばれることを想定しています。
 */
export async function initializeGeminiCore() {
    if (_isInitialized) return; 

    try {
        console.log("[Gemini Core] Loading settings...");
        const settings = loadSettings();
        
        console.log("[Gemini Core] Loading config...");
        // 偽のセッションIDと空の引数で初期化
        _config = await loadCliConfig(settings.merged, "openclaw-daemon-session", { _: [] }, {});
        
        console.log("[Gemini Core] Initializing storage and extensions...");
        await _config.storage.initialize();
        await _config.initialize();

        console.log("[Gemini Core] Validating and refreshing Auth...");
        const authType = await validateNonInteractiveAuth(
            settings.merged.security.auth.selectedType, 
            settings.merged.security.auth.useExternal, 
            _config, 
            settings
        );
        await _config.refreshAuth(authType);

        console.log("[Gemini Core] Initializing Gemini Client...");
        _geminiClient = _config.getGeminiClient();
        await _geminiClient.initialize();

        _isInitialized = true;
        console.log("[Gemini Core] Initialization complete. Standing by for API calls.");
    } catch (error) {
        console.error("[Gemini Core] Failed to initialize:", error);
        throw error; // ここでエラーを投げ、上位層でフォールバックさせる
    }
}

/**
 * 初期化済みの Gemini Client を使用して直接推論を行います。
 * 現状は非ストリーミング（一括応答）の generateContent を呼び出します。
 * 
 * @param {string} promptId 処理を識別するためのID
 * @param {Array} messages コンテキスト（過去の履歴と現在のプロンプト）
 * @param {string} model 使用するモデル（例: "auto-gemini-3"）
 * @param {AbortSignal} abortSignal キャンセル用のシグナル
 * @returns {Object} 推論結果（response.text 等を含む）
 */
export async function generateContentDirect(promptId, messages, model, abortSignal) {
    if (!_isInitialized || !_geminiClient) {
        throw new Error("Gemini Core is not initialized. Call initializeGeminiCore() first.");
    }

    let result = null;
    await promptIdContext.run(promptId, async () => {
         // まずは生APIで内容を取得する
         result = await _geminiClient.generateContent(
             { model: model || "auto-gemini-3" },
             messages,
             abortSignal
         );
    });

    return result;
}
