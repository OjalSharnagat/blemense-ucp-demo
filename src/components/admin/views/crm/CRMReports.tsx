import { useMemo } from 'react'
import { BarChart3, IndianRupee, Users, WalletCards } from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { panelClassName, crmMoney, getContactDisplayName, stageVariant, dealStageLabel } from './shared'

export default function CRMReports() {
  const { contacts, deals, activities, computeContactScore } = useCRMStore()

  const report = useMemo(() => {
    const scores = contacts
      .map((contact) => ({
        contact,
        score: computeContactScore(contact.id),
        totalDeals: deals.filter((deal) => deal.contactId === contact.id).reduce((sum, deal) => sum + deal.value, 0)
      }))
      .sort((a, b) => b.score - a.score)

    const stageMap = deals.reduce<Record<string, { count: number; value: number }>>((acc, deal) => {
      const current = acc[deal.stage] ?? { count: 0, value: 0 }
      current.count += 1
      current.value += deal.value
      acc[deal.stage] = current
      return acc
    }, {})

    const completedActivities = activities.filter((activity) => activity.status === 'COMPLETED').length
    const scheduledActivities = activities.filter((activity) => activity.status === 'SCHEDULED').length
    const missedActivities = activities.filter((activity) => activity.status === 'MISSED').length
    const totalContactValue = scores.reduce((sum, item) => sum + item.totalDeals, 0)
    const avgScore = scores.length ? Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length) : 0

    return {
      scores,
      stageMap,
      completedActivities,
      scheduledActivities,
      missedActivities,
      totalContactValue,
      avgScore
    }
  }, [activities, computeContactScore, contacts, deals])

  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Reports</h1>
        <p className="text-sm text-muted-foreground">Compact reports for lifetime value, pipeline health, and follow-up discipline.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tracked value</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(report.totalContactValue)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Average score</p>
            <p className="mt-2 text-2xl font-semibold">{report.avgScore}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed activities</p>
            <p className="mt-2 text-2xl font-semibold">{report.completedActivities}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open work</p>
            <p className="mt-2 text-2xl font-semibold">{(report.scheduledActivities + report.missedActivities).toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer lifetime value
            </CardTitle>
            <CardDescription>Top relationships by score and revenue footprint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.scores.slice(0, 8).map(({ contact, score, totalDeals }) => (
              <div key={contact.id} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{getContactDisplayName(contact)}</p>
                    <p className="text-xs text-muted-foreground">{contact.company || contact.type}</p>
                  </div>
                  <Badge variant={score >= 75 ? 'success' : score >= 45 ? 'warning' : 'secondary'}>{score}</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, score)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <p>{crmMoney.format(totalDeals)}</p>
                  <p className="text-muted-foreground">Value tied to contact</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Pipeline health
            </CardTitle>
            <CardDescription>Stage distribution and value concentration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const).map((stage) => {
              const stageData = report.stageMap[stage] ?? { count: 0, value: 0 }
              return (
                <div key={stage} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={stageVariant(stage)}>{dealStageLabel[stage]}</Badge>
                    <p className="text-sm text-muted-foreground">{stageData.count} deals</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, stageData.value / 2500)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <p>{crmMoney.format(stageData.value)}</p>
                    <p className="text-muted-foreground">Stage value</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <WalletCards className="h-5 w-5" />
              Activity mix
            </CardTitle>
            <CardDescription>How much work is actively moving versus waiting.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
              <p className="mt-2 text-2xl font-semibold">{report.completedActivities}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled</p>
              <p className="mt-2 text-2xl font-semibold">{report.scheduledActivities}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Missed</p>
              <p className="mt-2 text-2xl font-semibold">{report.missedActivities}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Contact ranking
            </CardTitle>
            <CardDescription>Useful for sorting your callback list and identifying who is worth chasing.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Deal Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.scores.slice(0, 8).map(({ contact, score, totalDeals }) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <p className="font-medium">{getContactDisplayName(contact)}</p>
                      <p className="text-xs text-muted-foreground">{contact.type}</p>
                    </TableCell>
                    <TableCell>{score}</TableCell>
                    <TableCell>{crmMoney.format(totalDeals)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

