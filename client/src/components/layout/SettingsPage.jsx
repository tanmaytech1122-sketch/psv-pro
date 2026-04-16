import { useAppStore } from '../../store/appStore'
import { Card, SectionTitle } from '../ui'

export default function SettingsPage() {
  const { units, setUnits } = useAppStore()
  return (
    <div className="max-w-lg">
      <Card title="Units &amp; Display">
        <div className="p-4 space-y-3">
          <SectionTitle>Unit System</SectionTitle>
          {['imperial','metric'].map(u => (
            <label key={u} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="units" value={u} checked={units===u} onChange={()=>setUnits(u)} className="accent-blue-500"/>
              <span className="text-sm text-slate-300 capitalize">{u}</span>
              <span className="text-xs text-slate-600">{u==='imperial'?'psig, °F, lb/hr, in²':'barg, °C, kg/hr, cm²'}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}
