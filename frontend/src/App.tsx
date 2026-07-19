import { useState } from 'react'
import Home from './components/Body/Home'
import Nav from './components/Header/Nav'
import Settings from './components/Header/Settings/Settings'
// import type { Theme } from "./types"
// import { loadTheme, saveTheme } from './lib/storage'

function App() {
    const [showSettings, setShowSettings] = useState(false)
    // const [theme,] = useState<Theme>("lightmode");

    // const changeTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    //   const value = e.target.value as Theme
    //   setTheme(value);
    // }

    // useEffect(() => {
    //   let mounted = true;

    //   const load = async () => {
    //     const theTheme = await loadTheme();
    //     if (mounted) setTheme(theTheme);
    //   }

    //   load();

    //   return () => {
    //     mounted = false;
    //   }
    // }, [])

    // useEffect(() => {
    //   saveTheme(theme);
    // }, [theme])

    return (
        <>
            <div
                className={`w-full max-w-md h-full flex flex-col overflow-hidden bg-indigo-950 text-stone-200`}
            >
                <Nav
                    showSettings={showSettings}
                    settingsClick={() => setShowSettings((s) => !s)}
                    // theme={theme}
                />
                <div className="flex-1 overflow-hidden">
                    {showSettings ? (
                        <Settings
                        // theme={theme}
                        // changeTheme={changeTheme}
                        />
                    ) : (
                        <Home
                        // theme={theme}
                        // changeTheme={changeTheme}
                        />
                    )}
                </div>
            </div>
        </>
    )
}

export default App
