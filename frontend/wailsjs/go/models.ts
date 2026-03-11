export namespace contracts {
	
	export class WarmupAvailability {
	    isAvailable: boolean;
	    reasonCode?: string;
	
	    static createFrom(source: any = {}) {
	        return new WarmupAvailability(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isAvailable = source["isAvailable"];
	        this.reasonCode = source["reasonCode"];
	    }
	}
	export class AccountSummary {
	    id: string;
	    displayName: string;
	    email?: string;
	    authKind: string;
	    createdAt: string;
	    updatedAt: string;
	    lastUsedAt?: string;
	    warmupAvailability: WarmupAvailability;
	
	    static createFrom(source: any = {}) {
	        return new AccountSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.displayName = source["displayName"];
	        this.email = source["email"];
	        this.authKind = source["authKind"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.lastUsedAt = source["lastUsedAt"];
	        this.warmupAvailability = this.convertValues(source["warmupAvailability"], WarmupAvailability);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UsageWindowSnapshot {
	    usedPercent?: number;
	    windowMinutes: number;
	    resetsAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new UsageWindowSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.usedPercent = source["usedPercent"];
	        this.windowMinutes = source["windowMinutes"];
	        this.resetsAt = source["resetsAt"];
	    }
	}
	export class AccountUsageSnapshot {
	    accountId: string;
	    planType?: string;
	    status: string;
	    reasonCode?: string;
	    fiveHour?: UsageWindowSnapshot;
	    weekly?: UsageWindowSnapshot;
	    refreshedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AccountUsageSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.planType = source["planType"];
	        this.status = source["status"];
	        this.reasonCode = source["reasonCode"];
	        this.fiveHour = this.convertValues(source["fiveHour"], UsageWindowSnapshot);
	        this.weekly = this.convertValues(source["weekly"], UsageWindowSnapshot);
	        this.refreshedAt = source["refreshedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AccountsSnapshot {
	    activeAccountId?: string;
	    accounts: AccountSummary[];
	
	    static createFrom(source: any = {}) {
	        return new AccountsSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.activeAccountId = source["activeAccountId"];
	        this.accounts = this.convertValues(source["accounts"], AccountSummary);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppError {
	    code: string;
	    args?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new AppError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.args = source["args"];
	    }
	}
	export class AppInfo {
	    name: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new AppInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	    }
	}
	export class AppMessage {
	    code: string;
	    args?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new AppMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.args = source["args"];
	    }
	}
	export class BootstrapPayload {
	    locale: string;
	    supportedLocales: string[];
	    hasManualOverride: boolean;
	    app: AppInfo;
	
	    static createFrom(source: any = {}) {
	        return new BootstrapPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.locale = source["locale"];
	        this.supportedLocales = source["supportedLocales"];
	        this.hasManualOverride = source["hasManualOverride"];
	        this.app = this.convertValues(source["app"], AppInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class OAuthCancelResult {
	    pending: boolean;
	
	    static createFrom(source: any = {}) {
	        return new OAuthCancelResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pending = source["pending"];
	    }
	}
	export class OAuthLoginInfo {
	    authUrl: string;
	    callbackPort: number;
	    pending: boolean;
	
	    static createFrom(source: any = {}) {
	        return new OAuthLoginInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.authUrl = source["authUrl"];
	        this.callbackPort = source["callbackPort"];
	        this.pending = source["pending"];
	    }
	}
	export class ProcessStatus {
	    foregroundCount: number;
	    backgroundCount: number;
	    canSwitch: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProcessStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.foregroundCount = source["foregroundCount"];
	        this.backgroundCount = source["backgroundCount"];
	        this.canSwitch = source["canSwitch"];
	    }
	}
	export class RenameAccountInput {
	    id: string;
	    displayName: string;
	
	    static createFrom(source: any = {}) {
	        return new RenameAccountInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.displayName = source["displayName"];
	    }
	}
	export class ResultEnvelope_codex_switch_internal_contracts_AccountUsageSnapshot_ {
	    data?: AccountUsageSnapshot;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_AccountUsageSnapshot_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], AccountUsageSnapshot);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_AccountsSnapshot_ {
	    data?: AccountsSnapshot;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_AccountsSnapshot_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], AccountsSnapshot);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_OAuthCancelResult_ {
	    data?: OAuthCancelResult;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_OAuthCancelResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], OAuthCancelResult);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_OAuthLoginInfo_ {
	    data?: OAuthLoginInfo;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_OAuthLoginInfo_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], OAuthLoginInfo);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_ProcessStatus_ {
	    data?: ProcessStatus;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_ProcessStatus_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], ProcessStatus);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SwitchAccountResult {
	    accounts: AccountsSnapshot;
	    restartPerformed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SwitchAccountResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accounts = this.convertValues(source["accounts"], AccountsSnapshot);
	        this.restartPerformed = source["restartPerformed"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_SwitchAccountResult_ {
	    data?: SwitchAccountResult;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_SwitchAccountResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], SwitchAccountResult);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UsageCollection {
	    items: AccountUsageSnapshot[];
	
	    static createFrom(source: any = {}) {
	        return new UsageCollection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], AccountUsageSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_UsageCollection_ {
	    data?: UsageCollection;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_UsageCollection_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], UsageCollection);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WarmupAccountResult {
	    accountId: string;
	    availability: WarmupAvailability;
	    status: string;
	    failureCode?: string;
	    completedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new WarmupAccountResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.availability = this.convertValues(source["availability"], WarmupAvailability);
	        this.status = source["status"];
	        this.failureCode = source["failureCode"];
	        this.completedAt = source["completedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_WarmupAccountResult_ {
	    data?: WarmupAccountResult;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_WarmupAccountResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], WarmupAccountResult);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WarmupSummary {
	    totalAccounts: number;
	    eligibleAccounts: number;
	    successfulAccounts: number;
	    failedAccounts: number;
	    skippedAccounts: number;
	
	    static createFrom(source: any = {}) {
	        return new WarmupSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalAccounts = source["totalAccounts"];
	        this.eligibleAccounts = source["eligibleAccounts"];
	        this.successfulAccounts = source["successfulAccounts"];
	        this.failedAccounts = source["failedAccounts"];
	        this.skippedAccounts = source["skippedAccounts"];
	    }
	}
	export class WarmupAllResult {
	    items: WarmupAccountResult[];
	    summary: WarmupSummary;
	
	    static createFrom(source: any = {}) {
	        return new WarmupAllResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], WarmupAccountResult);
	        this.summary = this.convertValues(source["summary"], WarmupSummary);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResultEnvelope_codex_switch_internal_contracts_WarmupAllResult_ {
	    data?: WarmupAllResult;
	    message?: AppMessage;
	    error?: AppError;
	
	    static createFrom(source: any = {}) {
	        return new ResultEnvelope_codex_switch_internal_contracts_WarmupAllResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], WarmupAllResult);
	        this.message = this.convertValues(source["message"], AppMessage);
	        this.error = this.convertValues(source["error"], AppError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StartOAuthLoginInput {
	    accountName: string;
	
	    static createFrom(source: any = {}) {
	        return new StartOAuthLoginInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountName = source["accountName"];
	    }
	}
	export class SwitchAccountInput {
	    accountId: string;
	    confirmRestart: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SwitchAccountInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.confirmRestart = source["confirmRestart"];
	    }
	}
	
	
	
	
	
	

}

