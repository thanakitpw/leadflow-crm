import ComingSoon from "@/components/coming-soon"

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function HelpPage({ params }: PageProps) {
  const { workspaceId } = await params

  return (
    <ComingSoon
      title="ศูนย์ช่วยเหลือ"
      description="คู่มือการใช้งาน, FAQ, และช่องทางติดต่อทีมสนับสนุน กำลังจัดทำอยู่"
      backHref={`/${workspaceId}`}
      backLabel="กลับแดชบอร์ด"
    />
  )
}
