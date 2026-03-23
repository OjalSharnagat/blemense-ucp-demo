import { Building2, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";

export default function SettingsView() {
  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure finance and business preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            to="/admin/settings/business-gst"
            className="flex items-center justify-between rounded-md border px-4 py-3 transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-100 p-2 text-blue-700">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Business Setup</p>
                <p className="text-xs text-muted-foreground">Registration status, scale, profile, bank and invoice defaults.</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/admin/settings/pos"
            className="mt-3 flex items-center justify-between rounded-md border px-4 py-3 transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-slate-100 p-2 text-slate-700">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">POS Configuration</p>
                <p className="text-xs text-muted-foreground">Tax display, receipts, stock, customer capture and shortcuts.</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/admin/crm/settings"
            className="mt-3 flex items-center justify-between rounded-md border px-4 py-3 transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">CRM Settings</p>
                <p className="text-xs text-muted-foreground">Pipeline stages, lead sources, custom fields, reminders and team members.</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
