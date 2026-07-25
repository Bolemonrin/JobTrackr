/** @format */

import { useState, useEffect } from 'react'
import SiteSettings from './SiteSettings'
// import Appearance from "./Appearance";
import Data from './Data'
import { getStoredToken, signIn, signOut } from '../../../lib/authModule'

// import type { SettingsProps } from "../../../types";

const Settings = () => {
    const [isConnected, setIsConnected] = useState(false)
    const [isChecking, setIsChecking] = useState(true)

    const bgClass = 'bg-slate-800 text-slate-100'
    const buttonPrimary =
        'w-full py-2.5 px-4 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white'
    const buttonSecondary =
        'w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-slate-700 hover:bg-slate-600 text-slate-200'

    useEffect(() => {
        getStoredToken().then((t) => {
            setIsConnected(!!t)
            setIsChecking(false)
        })
    }, [])

    const handleSignIn = async () => {
        try {
            await signIn()
            setIsConnected(true)
        } catch (e) {
            console.error('Sign-in failed with error: ', e)
            setIsConnected(false)
        }
    }

    const handleSignOut = async () => {
        try {
            await signOut()
            setIsConnected(false)
        } catch (e) {
            console.error('Sign-out error: ', e)
        } finally {
            setIsConnected(false) // clear UI state regardless
        }
    }

    return (
        <div
            className={`h-136.75 overflow-y-auto p-4 ${bgClass} transition-colors duration-200`}
        >
            <h1 className="text-2xl font-bold tracking-tight mb-6">Settings</h1>

            <div className="space-y-4 max-w-2xl pb-4">
                {isChecking ? (
                    <p className="text-sm text-slate-400">
                        Checking connection…
                    </p>
                ) : isConnected ? (
                    <>
                        <SiteSettings />
                        <Data />
                        <button
                            onClick={handleSignOut}
                            className={buttonSecondary}
                        >
                            Disconnect Google Account
                        </button>
                    </>
                ) : (
                    <div className="p-3 rounded-xl border bg-slate-800 border-slate-700 space-y-3">
                        <p className="text-sm text-slate-400">
                            Connect your Google account to sync applications to
                            your own Google Sheet.
                        </p>
                        <button
                            onClick={handleSignIn}
                            className={buttonPrimary}
                        >
                            Sign in with Google
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Settings
