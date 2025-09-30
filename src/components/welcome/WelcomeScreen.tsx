interface WelcomeScreenProps {
  onPromptSelect: (prompt: string) => void;
}

export function WelcomeScreen({ onPromptSelect }: WelcomeScreenProps) {
  const prompts = [
    {
      title: "Weekend in Tokyo",
      description: "3 days exploring culture, food and points of interest",
      prompt: "Plan a 3-day trip to Tokyo"
    },
    {
      title: "European adventure",
      description: "Multi-city trip with transport and schedules",
      prompt: "Plan a week in Europe visiting 3 cities"
    },
    {
      title: "Budget backpacking",
      description: "Budget adventure trip",
      prompt: "Plan a budget backpacking trip to Southeast Asia"
    },
    {
      title: "Luxury getaway",
      description: "Premium experiences and accommodations",
      prompt: "Plan a luxury honeymoon in the Maldives"
    }
  ];

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-4">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8">
          How can I help you today?
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {prompts.map((item, index) => (
            <button 
              key={index}
              className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
              onClick={() => onPromptSelect(item.prompt)}
            >
              <div className="text-sm font-medium text-gray-900 mb-1">
                {item.title}
              </div>
              <div className="text-xs text-gray-600">
                {item.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
