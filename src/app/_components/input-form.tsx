interface InputFormProps {
	handleSubmit: (e: React.FormEvent) => void;
	query: string;
	setQuery: (query: string) => void;
	generatePreSQLMutation: any;
}

export function InputForm({
	handleSubmit,
	query,
	setQuery,
	generatePreSQLMutation,
}: InputFormProps) {
	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<textarea
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="请输入你的自然语言查询，例如：&#10;• 今天有哪些新客户？&#10;• 统计每个业务员的客户数量&#10;• 找出上周跟进过的所有商机&#10;• 哪些客户的 WhatsApp 消息最多？"
				className="h-24 w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
				disabled={generatePreSQLMutation.isPending}
			/>
			<div className="flex items-center justify-between">
				<div className="text-gray-600 text-sm">
					💡 系统会智能分析并精确选择需要的表和字段
				</div>
				<button
					type="submit"
					disabled={generatePreSQLMutation.isPending || !query.trim()}
					className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{generatePreSQLMutation.isPending ? "🔄 分析中..." : "🚀 生成 PreSQL"}
				</button>
			</div>
		</form>
	);
}
