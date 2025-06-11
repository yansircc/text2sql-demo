import { Navigation } from "@/app/_components/navigation";
import { SQLResultView } from "@/app/_components/sql-result-view";
import { HydrateClient } from "@/trpc/server";

export default async function SQLResultPage() {
	return (
		<HydrateClient>
			<div className="min-h-screen bg-gray-50">
				<Navigation />
				<div className="mx-auto max-w-6xl px-6 py-6">
					<SQLResultView />
				</div>
			</div>
		</HydrateClient>
	);
}
