// filepath: d:\yokiwong\repo\auto-tag\obsidian-plugin-auto-tag\src\plugin\modals\debugModal\debugModal.tsx
import {App, Modal} from 'obsidian';
import * as React from "react";
import {Root, createRoot} from "react-dom/client";
import {AutoTagPluginSettings} from '../../settings/settings';
import AutoTagPlugin from "../../autoTagPlugin";

interface DebugInfo {
    apiEndpoint: string;
    requestBody: string;
    responseData?: string;
    errorMessage?: string;
    timestamp: number;
}

export class DebugRequestModal extends Modal {
    plugin: AutoTagPlugin;
    reactRoot: Root | null;
    debugLogs: DebugInfo[];

    constructor(app: App, plugin: AutoTagPlugin) {
        super(app);
        this.plugin = plugin;
        this.reactRoot = null;
        this.debugLogs = plugin.debugLogs || [];
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        const reactContainer = contentEl.createDiv();
        this.reactRoot = createRoot(reactContainer);
        this.reactRoot.render(
            <React.StrictMode>
                <DebugView 
                    debugLogs={this.debugLogs}
                    settings={this.plugin.settings}
                    onClose={() => this.close()}
                    clearLogs={() => {
                        this.plugin.debugLogs = [];
                        this.close();
                    }}
                />
            </React.StrictMode>
        );
    }

    onClose() {
        this.reactRoot?.unmount();
        const {contentEl} = this;
        contentEl.empty();
    }
}

interface DebugViewProps {
    debugLogs: DebugInfo[];
    settings: AutoTagPluginSettings;
    onClose: () => void;
    clearLogs: () => void;
}

function DebugView(props: DebugViewProps): JSX.Element {
    const {debugLogs, settings, onClose, clearLogs} = props;
    const [selectedLog, setSelectedLog] = React.useState<DebugInfo | null>(
        debugLogs.length > 0 ? debugLogs[0] : null
    );

    // 格式化JSON以便更好地显示
    const formatJSON = (jsonString: string) => {
        try {
            return JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch (e) {
            return jsonString;
        }
    };

    return (
        <div className="debug-modal">
            <h2>API Request Debug Information</h2>
            
            <div className="debug-settings-info">
                <h3>Current Settings</h3>
                <div className="debug-settings-grid">
                    <div className="debug-setting-label">Use Custom Base URL:</div>
                    <div>{settings.useCustomBaseUrl ? 'Yes' : 'No'}</div>
                    
                    {settings.useCustomBaseUrl && (
                        <>
                            <div className="debug-setting-label">Custom Base URL:</div>
                            <div>{settings.customBaseUrl}</div>
                        </>
                    )}
                    
                    <div className="debug-setting-label">Selected Model:</div>
                    <div>{settings.openaiModel.name} ({settings.openaiModel.id})</div>
                    
                    <div className="debug-setting-label">API Key Set:</div>
                    <div>{settings.openaiApiKey ? 'Yes (hidden for security)' : 'No'}</div>
                </div>
            </div>

            {debugLogs.length === 0 ? (
                <div className="debug-no-logs">
                    <p>No API requests have been logged yet.</p>
                    <p>Try generating tags to see request logs here.</p>
                </div>
            ) : (
                <div className="debug-content">
                    <div className="debug-sidebar">
                        <h3>Request History</h3>
                        <div className="debug-log-list">
                            {debugLogs.map((log, index) => (
                                <div 
                                    key={index}
                                    className={`debug-log-item ${selectedLog === log ? 'selected' : ''}`}
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <div className="debug-log-time">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </div>
                                    <div className="debug-log-status">
                                        {log.errorMessage ? '❌ Error' : '✅ Success'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="debug-details">
                        {selectedLog && (
                            <>
                                <h3>Request Details</h3>
                                <div className="debug-section">
                                    <h4>API Endpoint</h4>
                                    <div className="debug-code">{selectedLog.apiEndpoint}</div>
                                </div>
                                
                                <div className="debug-section">
                                    <h4>Request Body</h4>
                                    <pre className="debug-code">{formatJSON(selectedLog.requestBody)}</pre>
                                </div>
                                
                                {selectedLog.responseData && (
                                    <div className="debug-section">
                                        <h4>Response</h4>
                                        <pre className="debug-code">{formatJSON(selectedLog.responseData)}</pre>
                                    </div>
                                )}
                                
                                {selectedLog.errorMessage && (
                                    <div className="debug-section">
                                        <h4>Error</h4>
                                        <div className="debug-error">{selectedLog.errorMessage}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
            
            <div className="debug-footer">
                <button onClick={clearLogs} className="mod-warning">
                    Clear Logs
                </button>
                <button onClick={onClose} className="mod-cta">
                    Close
                </button>
            </div>
            
            <style>{`
                .debug-modal {
                    padding: 10px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                
                .debug-settings-info {
                    margin-bottom: 20px;
                    padding: 10px;
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 5px;
                }
                
                .debug-settings-grid {
                    display: grid;
                    grid-template-columns: 150px 1fr;
                    gap: 8px;
                }
                
                .debug-setting-label {
                    font-weight: bold;
                }
                
                .debug-content {
                    display: flex;
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 5px;
                    height: 50vh;
                    margin-bottom: 20px;
                }
                
                .debug-sidebar {
                    width: 200px;
                    border-right: 1px solid var(--background-modifier-border);
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .debug-log-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .debug-log-item {
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .debug-log-item:hover {
                    background-color: var(--background-modifier-hover);
                }
                
                .debug-log-item.selected {
                    background-color: var(--background-modifier-active);
                }
                
                .debug-details {
                    flex: 1;
                    padding: 10px;
                    overflow-y: auto;
                }
                
                .debug-section {
                    margin-bottom: 15px;
                }
                
                .debug-code {
                    background-color: var(--background-secondary);
                    padding: 10px;
                    border-radius: 4px;
                    overflow-x: auto;
                    font-family: monospace;
                    white-space: pre-wrap;
                }
                
                .debug-error {
                    color: var(--text-error);
                    background-color: var(--background-modifier-error);
                    padding: 10px;
                    border-radius: 4px;
                }
                
                .debug-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .debug-no-logs {
                    text-align: center;
                    padding: 40px;
                    color: var(--text-muted);
                }
            `}</style>
        </div>
    );
}