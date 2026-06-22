import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Filter } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MY_ASSESSMENTS } from "@/lib/mock-data";

export const Route = createFileRoute("/app/my-assessments")({
  component: MyAssessments,
});

function MyAssessments() {
  const [tab, setTab] = useState("All");
  const list = MY_ASSESSMENTS.filter((a) => tab === "All" || a.status === tab);

  return (
    <>
      <PageHeader title="My assessments" description="Assessments assigned to you." />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="All">All</TabsTrigger>
              <TabsTrigger value="To do">To do</TabsTrigger>
              <TabsTrigger value="In progress">In progress</TabsTrigger>
              <TabsTrigger value="Completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm">
            <Filter className="mr-1.5 h-4 w-4" /> Filters
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div>
                  <div className="text-xs text-muted-foreground">{a.training}</div>
                  <div className="mt-0.5 text-sm font-semibold">{a.title}</div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {a.type} · {a.timeLimit} min
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-xs text-muted-foreground">Due {a.due}</div>
                <div className="mt-auto flex justify-end">
                  {a.status === "Completed" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/assessment/$id/result" params={{ id: a.id }}>
                        View result
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm">
                      <Link to="/assessment/$id/access" params={{ id: a.id }}>
                        {a.status === "In progress" ? "Continue" : "Start"}
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
