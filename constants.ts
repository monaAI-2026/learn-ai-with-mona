
import { Video } from './types';

export const MOCK_VIDEOS: Video[] = [
  {
    id: '1',
    youtubeId: '7xTGNNLPyMI',
    title: 'Ben Horowitz: The AI Revolution and the Future of Software',
    description: 'A deep conversation about how AI is fundamentally changing the architecture of modern software and the role of the founder.',
    categories: ['Founder Interview', 'Technical'],
    thumbnail: 'https://i.ytimg.com/vi/7xTGNNLPyMI/maxresdefault.jpg',
    duration: '45:20',
    segments: [
      { startTime: 0, endTime: 300, title: "Introduction to AI Transformation" },
      { startTime: 300, endTime: 720, title: "Software Architecture Shifts" },
      { startTime: 720, endTime: 1200, title: "The Mental Model of LLMs" },
      { startTime: 1200, endTime: 1800, title: "Future of Product Design" }
    ],
    transcriptParts: [
      {
        en: "while it is a comprehensive but General audience introduction to large language models like Chat GPT and what I'm hoping to achieve in this video",
        zh: "大家好，我一直想做这个视频，这是一个全面但面向普通观众的大语言模型介绍，比如ChatGPT，我希望在这个视频中实现的目标",
        highlights: [
          { type: 'technical', text: 'large language models', definition: 'Deep learning algorithms that can recognize, summarize, translate, predict and generate text.', translation: '大语言模型' }
        ]
      },
      {
        en: "is to give you kind of mental model for thinking through what it is that this tool is it is obviously magical and amazing in some respects it's uh really good at some things not very good at. AI sometimes experiences hallucinations.",
        zh: "是给大家一些思考这个工具本质的心理模型。它虽然在某些方面神奇而出色，有些事情它做得特别好，有些则不太行。AI有时会产生幻觉。",
        highlights: [
          { type: 'language', text: 'obviously', definition: 'In a way that is easily perceived or understood; clearly.', pos: 'adv.', translation: '明显地/显而易见' },
          { type: 'technical', text: 'hallucinations', definition: 'A phenomenon where the model generates incorrect or nonsensical information confidently.', translation: '幻觉' }
        ]
      },
      {
        en: "other things and there's also a lot of sharp edges to be aware of so what is behind this text box you can put anything in",
        zh: "其他事情，还有很多需要注意的锋利边缘，那么这个你可以输入任何内容的文本框背后到底是什么",
        highlights: [
          { type: 'language', text: 'sharp edges', definition: 'Potential risks or difficulties that are not immediately apparent.', translation: '锋利的边缘/隐患' }
        ]
      }
    ]
  },
  {
    id: '2',
    youtubeId: '2-S6Tls_7Sg',
    title: 'The Future of AI Agents and Autonomous Systems',
    description: 'Exploring how LLMs are evolving into agents that can take actions in the real world.',
    categories: ['Technical', 'Product'],
    thumbnail: 'https://picsum.photos/seed/ai2/800/450',
    duration: '18:20'
  }
];
