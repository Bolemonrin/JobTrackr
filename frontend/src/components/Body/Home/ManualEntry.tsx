import type { ManualEntryProps } from "../../../types"

const ManualEntry = ({ onOpen }: ManualEntryProps) => {
    const entryButton = "bg-white hover:bg-gray-300 text-slate-700"

    return (
        <div className="flex justify-center">
            <button
                onClick={onOpen}
                type="button"
                className={`py-2 px-6 rounded-full font-medium ${entryButton}`}
            >
                + Add Manual Entry
            </button>
        </div>
    )
}

export default ManualEntry
