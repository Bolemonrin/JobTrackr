/** @format */

import SiteSettings from './SiteSettings'
// import Appearance from "./Appearance";
import Data from './Data'

// import type { SettingsProps } from "../../../types";

const Settings = () => {
    // We determine the main background classes based on theme
    const bgClass = 'bg-slate-800 text-slate-100'

    return (
        <div
            className={`h-136.75 overflow-y-auto p-4 ${bgClass} transition-colors duration-200`}
        >
            <h1 className="text-2xl font-bold tracking-tight mb-6">Settings</h1>

            <div className="space-y-4 max-w-2xl pb-4">
                <SiteSettings
                // theme={theme}
                />
                {/* <Appearance
					theme={theme}
					changeTheme={changeTheme}
				/> */}
                <Data
                // theme={theme}
                />
            </div>
        </div>
    )
}

export default Settings
