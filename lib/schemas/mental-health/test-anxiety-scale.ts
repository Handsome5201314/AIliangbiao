import type {
  ExecutableScaleDefinition,
  ScaleOption,
  ScaleQuestion,
  ScaleScoreResult,
} from "../core/types";

const createTASOptions = (): ScaleOption[] => [
  {
    label: "True",
    score: 1,
    aliases: ["是", "对", "符合", "正确", "有的", "true"],
    description: { zh: "符合我的实际情况", en: "True" },
  },
  {
    label: "False",
    score: 0,
    aliases: ["否", "错", "不符合", "错误", "没有", "false"],
    description: { zh: "不符合我的实际情况", en: "False" },
  },
];

export const TAS_37_Scale: ExecutableScaleDefinition = {
  id: "TAS_37",
  version: "1.0",
  title: {
    zh: "考试焦虑量表 (TAS)",
    en: "Test Anxiety Scale (TAS)",
  },
  description: {
    zh: "改编自 Sarason (1980) 的考试焦虑量表。该问卷用于评估受测者面对考试和测验时的焦虑、紧张程度及伴随的生理、情绪反应。",
    en: "Adapted from Sarason (1980). This scale assesses anxiety, tension, and related physiological and emotional responses during tests and exams.",
  },
  category: "Mental Health",
  source: "builtin",
  tags: ["焦虑", "考试焦虑", "学生心理", "情绪评估"],
  estimatedMinutes: 8,
  interactionMode: "voice_guided",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: false,
  questions: [
    {
      id: 1,
      text: { zh: "在重要的考试中，我发现自己总在想别的同学比我聪明多少。", en: "While taking an important exam, I find myself thinking of how much brighter the other students are than I am." },
      clinical_intent: "评估考试中的社会比较与自我贬低",
      colloquial: { zh: "重要考试的时候，你会不会总在想，别的同学是不是都比我聪明？" },
      fallback_examples: [{ zh: "比如考试做不出来时，脑子里总是想着别人肯定都会做？" }],
      options: createTASOptions(),
    },
    {
      id: 2,
      text: { zh: "如果我要参加智力测试，我在考前会非常担心。", en: "If I were to take an intelligence test, I would worry a great deal before taking it." },
      clinical_intent: "评估对智力评估的预期性焦虑",
      colloquial: { zh: "如果告诉你马上要测一下智商，你在考前会特别担心吗？" },
      fallback_examples: [{ zh: "会不会在考前一直害怕自己测出来分数很低？" }],
      options: createTASOptions(),
    },
    {
      id: 3,
      text: { zh: "如果我知道要参加智力测试，我会感到自信和放松。", en: "If I knew I was going to take an intelligence test, I would feel confident and relaxed." },
      clinical_intent: "评估面对智力测试的积极情绪（反向指标，当前按 PDF 原文计分）",
      colloquial: { zh: "要是知道要测智商，你反而会觉得很自信、很放松吗？" },
      fallback_examples: [{ zh: "也就是对这种测试毫无压力，反而觉得有把握？" }],
      options: createTASOptions(),
    },
    {
      id: 4,
      text: { zh: "在重要的考试中，我会大量出汗。", en: "While taking an important exam, I perspire a great deal." },
      clinical_intent: "评估考试期间的自主神经亢奋（出汗）",
      colloquial: { zh: "遇到大考的时候，你会紧张得出很多汗吗？" },
      fallback_examples: [{ zh: "比如手心或者额头一直冒汗？" }],
      options: createTASOptions(),
    },
    {
      id: 5,
      text: { zh: "在课堂考试中，我发现自己在想与实际课程内容无关的事情。", en: "During class examinations, I find myself thinking of things unrelated to the actual course material." },
      clinical_intent: "评估任务无关思考导致的注意力分散",
      colloquial: { zh: "随堂测验的时候，你会不会经常走神，想些跟考试完全无关的事情？" },
      fallback_examples: [{ zh: "比如盯着试卷，脑子里却在想中午吃什么或者昨天看的小说？" }],
      options: createTASOptions(),
    },
    {
      id: 6,
      text: { zh: "当我不得不参加突击考试时，我会感到非常恐慌。", en: "I get to feeling very panicky when I have to take a surprise exam." },
      clinical_intent: "评估面对不可预测测验的恐慌反应",
      colloquial: { zh: "遇到老师突然搞“突击测验”，你会觉得非常恐慌吗？" },
      fallback_examples: [{ zh: "就是那种没有任何防备被叫来考试，心里会特别慌张？" }],
      options: createTASOptions(),
    },
    {
      id: 7,
      text: { zh: "在考试中，我总是不由自主地去想考砸的后果。", en: "During a test, I find myself thinking of the consequences of failing." },
      clinical_intent: "评估失败恐惧引发的认知干扰",
      colloquial: { zh: "考试的时候，你会不会老是在想，万一这次没考好会有什么后果？" },
      fallback_examples: [{ zh: "比如担心考砸了会被父母骂，或者拿不到学分？" }],
      options: createTASOptions(),
    },
    {
      id: 8,
      text: { zh: "在重要考试后，我经常紧张到胃不舒服。", en: "After important tests, I am frequently so tense my stomach gets upset." },
      clinical_intent: "评估考试后的躯体化表现（肠胃不适）",
      colloquial: { zh: "重要考试结束后，你会不会经常紧张到胃疼或者肚子不舒服？" },
      fallback_examples: [{ zh: "考完试整个人绷得太紧，导致胃部很难受？" }],
      options: createTASOptions(),
    },
    {
      id: 9,
      text: { zh: "在智力测试和期末考试这种场合，我的大脑会一片空白（僵住）。", en: "I freeze up on things like intelligence tests and final exams." },
      clinical_intent: "评估高压下的认知瘫痪",
      colloquial: { zh: "遇到像期末大考这样的场合，你会不会紧张到大脑突然一片空白，彻底僵住？" },
      fallback_examples: [{ zh: "明明复习过，但在考场上突然什么都想不起来了？" }],
      options: createTASOptions(),
    },
    {
      id: 10,
      text: { zh: "在一次考试中取得好成绩，似乎并不能增加我对下一次考试的信心。", en: "Getting good grades on one test doesn't seem to increase my confidence on the second." },
      clinical_intent: "评估自我效能感的脆弱性",
      colloquial: { zh: "就算某次考试考得挺好，似乎也不能让你对下一次考试更有信心，是这样吗？" },
      fallback_examples: [{ zh: "好成绩也不能缓解你对下一次测验的担忧？" }],
      options: createTASOptions(),
    },
    {
      id: 11,
      text: { zh: "在重要的考试中，有时我感到心跳非常快。", en: "I sometimes feel my heart beating very fast during important exams." },
      clinical_intent: "评估生理上的心动过速反应",
      colloquial: { zh: "大考的时候，你会觉得自己的心跳非常快吗？" },
      fallback_examples: [{ zh: "紧张到能感觉到心脏‘砰砰’狂跳？" }],
      options: createTASOptions(),
    },
    {
      id: 12,
      text: { zh: "考完试后，我总觉得我本可以考得更好。", en: "After taking a test, I always feel I could have done better than I actually did." },
      clinical_intent: "评估考后的持续性反刍和自我苛求",
      colloquial: { zh: "每次考完试，你是不是总觉得遗憾，觉得自己明明能考得更好？" },
      fallback_examples: [{ zh: "总觉得没发挥出自己的真实水平？" }],
      options: createTASOptions(),
    },
    {
      id: 13,
      text: { zh: "考完试后，我通常会感到沮丧。", en: "I usually get depressed after taking a test." },
      clinical_intent: "评估考后的负面情绪体验",
      colloquial: { zh: "考完试交卷之后，你会通常觉得心情很低落、很沮丧吗？" },
      fallback_examples: [{ zh: "即使还没出成绩，考完心里也很难受？" }],
      options: createTASOptions(),
    },
    {
      id: 14,
      text: { zh: "在期末考试前，我有一种不安、烦躁的感觉。", en: "I have an uneasy, upset feeling before taking a final examination." },
      clinical_intent: "评估预期性的一般性烦躁",
      colloquial: { zh: "期末考试之前，你心里会一直有一种烦躁和不安的感觉吗？" },
      fallback_examples: [{ zh: "就是考前坐立难安，觉得心里不踏实？" }],
      options: createTASOptions(),
    },
    {
      id: 15,
      text: { zh: "考试时，我的情绪不会干扰我的发挥。", en: "When taking a test, my emotional feelings do not interfere with my performance." },
      clinical_intent: "评估情绪控制能力（反向指标，当前按 PDF 原文计分）",
      colloquial: { zh: "在考场上，你觉得自己的情绪不会影响做题发挥，对吗？" },
      fallback_examples: [{ zh: "也就是能把个人情绪放在一边，专心答题？" }],
      options: createTASOptions(),
    },
    {
      id: 16,
      text: { zh: "在课程考试中，我经常因为太紧张而忘记了我原本知道的知识点。", en: "During a course examination, I frequently get so nervous that I forget facts I really know." },
      clinical_intent: "评估紧张导致的记忆提取阻碍",
      colloquial: { zh: "考试的时候，你会不会因为太紧张，把明明背过的东西全忘了？" },
      fallback_examples: [{ zh: "下了考场马上就想起来，但考场上就是死活想不起来？" }],
      options: createTASOptions(),
    },
    {
      id: 17,
      text: { zh: "在重要考试中，我似乎总是在打败自己（自我挫败）。", en: "I seem to defeat myself while working on important tests." },
      clinical_intent: "评估无助感和自我妨碍",
      colloquial: { zh: "重要考试时，你会不会觉得不是题目太难，而是自己把自己打败了？" },
      fallback_examples: [{ zh: "就是因为心态崩溃而导致发挥失常？" }],
      options: createTASOptions(),
    },
    {
      id: 18,
      text: { zh: "我越是努力备考或在考试中越是用力，我就越感到困惑。", en: "The harder I work at taking a test or studying for one, the more confused I get." },
      clinical_intent: "评估努力与表现的矛盾体验",
      colloquial: { zh: "你会不会觉得，自己为了考试越是死磕、越是用力，反而脑子里越乱？" },
      fallback_examples: [{ zh: "复习得越狠，反而越不知道怎么做题了？" }],
      options: createTASOptions(),
    },
    {
      id: 19,
      text: { zh: "考试一结束，我就试图不再去担心它，但我就是做不到。", en: "As soon as an exam is over, I try to stop worrying about it, but I just can't." },
      clinical_intent: "评估难以中止的焦虑反刍",
      colloquial: { zh: "考试一结束，你是不是想让自己不去想它了，但脑子里还是控制不住地担心？" },
      fallback_examples: [{ zh: "交卷了还一直惦记着哪道题写错了？" }],
      options: createTASOptions(),
    },
    {
      id: 20,
      text: { zh: "在考试期间，我有时会怀疑自己到底能不能顺利毕业。", en: "During exams, I sometimes wonder if I'll ever get through school." },
      clinical_intent: "评估灾难化认知",
      colloquial: { zh: "考试那段时间，你会不会甚至开始怀疑，自己到底能不能顺利毕业？" },
      fallback_examples: [{ zh: "觉得一场考试考不好，整个学业都要完蛋了？" }],
      options: createTASOptions(),
    },
    {
      id: 21,
      text: { zh: "我宁愿写一篇论文，也不愿通过考试来获得这门课的成绩。", en: "I would rather write a paper than take an examination for my grade in a course." },
      clinical_intent: "评估对考试形式的特定回避行为",
      colloquial: { zh: "为了拿学分，你是不是宁可写篇论文，也不愿去参加闭卷考试？" },
      fallback_examples: [{ zh: "觉得写文章慢慢磨，也比考场上的高压好受得多？" }],
      options: createTASOptions(),
    },
    {
      id: 22,
      text: { zh: "我希望考试不要这么困扰我。", en: "I wish examinations did not bother me so much." },
      clinical_intent: "评估对自身焦虑状态的不适感",
      colloquial: { zh: "你是不是特别希望考试这件事，不要再这么折磨你了？" },
      fallback_examples: [{ zh: "觉得被考试带来的压力搞得很心累？" }],
      options: createTASOptions(),
    },
    {
      id: 23,
      text: { zh: "我觉得如果能一个人独自考试，而且没有时间限制的压力，我能考得好得多。", en: "I think I could do much better on tests if I could take them alone and not feel pressured by time limits." },
      clinical_intent: "评估时间压力和竞争环境对表现的干扰",
      colloquial: { zh: "你会觉得，如果让你一个人待着考，而且不限制时间，你能考得比现在好得多吗？" },
      fallback_examples: [{ zh: "主要是考场倒计时和大家都在做题的氛围让你很崩溃？" }],
      options: createTASOptions(),
    },
    {
      id: 24,
      text: { zh: "想到我可能会在这门课中得到的分数，就会干扰我的学习和考试表现。", en: "Thinking about the grade I may get in a course interferes with my studying and performance on tests." },
      clinical_intent: "评估对结果评价的担忧如何干扰过程",
      colloquial: { zh: "学习和考试的时候，一想到最后的分数，是不是就会打乱你的节奏，影响发挥？" },
      fallback_examples: [{ zh: "过度在意结果，导致复习和做题时都没法专心？" }],
      options: createTASOptions(),
    },
    {
      id: 25,
      text: { zh: "如果能取消考试，我觉得我实际上能学到更多东西。", en: "If examinations could be done away with, I think I would actually learn more." },
      clinical_intent: "评估考试焦虑对求知欲的抑制",
      colloquial: { zh: "你会不会觉得，如果学校彻底取消考试，你反而能学到更多东西？" },
      fallback_examples: [{ zh: "觉得现在的学习全是为了应付考试，反而影响真正吸收知识？" }],
      options: createTASOptions(),
    },
    {
      id: 26,
      text: { zh: "对待考试我的态度是：“如果我现在还不知道，再担心也没用。”", en: "On exams I take the attitude, 'If I don't know it now, there's no point in worrying about it.'" },
      clinical_intent: "评估对不可控结果的接纳程度（反向指标，当前按 PDF 原文计分）",
      colloquial: { zh: "对待考试，你的态度是不是比较随缘，觉得‘反正现在也不会了，干着急也没用’？" },
      fallback_examples: [{ zh: "就是考前能放下包袱，不强求？" }],
      options: createTASOptions(),
    },
    {
      id: 27,
      text: { zh: "我真的很不理解为什么有些人会对考试那么心烦意乱。", en: "I really don't see why some people get so upset about tests." },
      clinical_intent: "评估自身缺乏考试压力体验（反向指标，当前按 PDF 原文计分）",
      colloquial: { zh: "你是不是完全无法理解，为什么有的人一到考试就紧张得要命？" },
      fallback_examples: [{ zh: "觉得考试就是件很平常的事，不值得那么心烦？" }],
      options: createTASOptions(),
    },
    {
      id: 28,
      text: { zh: "觉得自己会考砸的想法干扰了我在考试中的表现。", en: "Thoughts of doing poorly interfere with my performance on tests." },
      clinical_intent: "评估负面预期对表现的直接损害",
      colloquial: { zh: "在考场上，脑子里总是冒出‘我要考砸了’的念头，这会严重影响你的发挥吗？" },
      fallback_examples: [{ zh: "因为老想着考不好，连题都看不进去？" }],
      options: createTASOptions(),
    },
    {
      id: 29,
      text: { zh: "我为期末考试所做的复习，并不比平时课程学习更努力。", en: "I don't study any harder for final exams than for the rest of my coursework." },
      clinical_intent: "评估对大考的平淡化态度（反向指标，当前按 PDF 原文计分）",
      colloquial: { zh: "你期末考试前的复习强度，是不是和平时差不多，并没有特意去拼命熬夜看书？" },
      fallback_examples: [{ zh: "就是用平时一样的节奏对待期末考试？" }],
      options: createTASOptions(),
    },
    {
      id: 30,
      text: { zh: "即使我为考试做好了充分的准备，我仍然感到非常焦虑。", en: "Even when I'm well prepared for a test, I feel very anxious about it." },
      clinical_intent: "评估超越客观准备状态的特质性考试焦虑",
      colloquial: { zh: "就算已经复习得很充分了，一想到考试你还是会特别焦虑吗？" },
      fallback_examples: [{ zh: "明明都会了，心里还是止不住地发慌？" }],
      options: createTASOptions(),
    },
    {
      id: 31,
      text: { zh: "在重要考试前，我吃不下东西。", en: "I don't enjoy eating before an important test." },
      clinical_intent: "评估由于交感神经兴奋导致的食欲减退",
      colloquial: { zh: "大考之前，你是不是紧张得根本吃不下饭？" },
      fallback_examples: [{ zh: "看到饭菜也没胃口，甚至觉得反胃？" }],
      options: createTASOptions(),
    },
    {
      id: 32,
      text: { zh: "在重要的考试前，我发现自己的手或手臂在发抖。", en: "Before an important examination, I find my hands or arms trembling." },
      clinical_intent: "评估躯体化震颤表现",
      colloquial: { zh: "重大考试前，你会紧张到发现自己的手或胳膊在发抖吗？" },
      fallback_examples: [{ zh: "拿笔的时候手哆嗦个不停？" }],
      options: createTASOptions(),
    },
    {
      id: 33,
      text: { zh: "我很少觉得考前需要“临时抱佛脚”。", en: "I seldom feel the need for 'cramming' before an exam." },
      clinical_intent: "评估对考前突击的依赖感低（反向指标，当前按 PDF 原文计分）",
      colloquial: { zh: "你是不是很少在考前一天疯狂熬夜、临时抱佛脚？" },
      fallback_examples: [{ zh: "觉得没必要为了考试突击背书？" }],
      options: createTASOptions(),
    },
    {
      id: 34,
      text: { zh: "学校应该认识到，有些学生面对考试比其他人更紧张，并且这会影响他们的表现。", en: "The college should recognize that some students are more nervous than others about tests and that this affects their performance." },
      clinical_intent: "评估对应试教育体制施压的外部归因与不满",
      colloquial: { zh: "你是不是非常同意，学校应该考虑到有些人天生考试容易紧张，这会影响他们的成绩？" },
      fallback_examples: [{ zh: "觉得一刀切的考试制度对容易紧张的人很不公平？" }],
      options: createTASOptions(),
    },
    {
      id: 35,
      text: { zh: "考试期间不应该被弄得如此气氛紧张。", en: "It seems to me that examination periods should not be made such intense situations." },
      clinical_intent: "评估对高压环境的厌恶",
      colloquial: { zh: "你会不会觉得，大家把考试季的气氛搞得太紧张、太恐怖了？" },
      fallback_examples: [{ zh: "特别反感那种全员如临大敌的氛围？" }],
      options: createTASOptions(),
    },
    {
      id: 36,
      text: { zh: "就在发下考试卷子的前一刻，我开始感到非常不安。", en: "I started feeling very uneasy just before getting a test paper back." },
      clinical_intent: "评估接触到试卷或成绩瞬间的高峰压力反应",
      colloquial: { zh: "不管考前怎么样，就在试卷发到手里的那一瞬间，你是不是会感到非常不安？" },
      fallback_examples: [{ zh: "或者在等老师发批改后的试卷时，心里特别七上八下？" }],
      options: createTASOptions(),
    },
    {
      id: 37,
      text: { zh: "我很害怕那种老师喜欢搞“随堂测验”的课。", en: "I dread courses where the instructor has the habit of giving 'pop' quizzes." },
      clinical_intent: "评估对不确定性考核的逃避心理",
      colloquial: { zh: "你是不是特别害怕那种老师喜欢搞突然袭击、随堂小测验的课？" },
      fallback_examples: [{ zh: "一上那门课就心惊肉跳，生怕突然掏出一张卷子？" }],
      options: createTASOptions(),
    },
  ],

  calculateScore: (answers: number[]): ScaleScoreResult => {
    const safeAnswers =
      answers.length === 37
        ? answers
        : [...answers.slice(0, 37), ...Array(Math.max(0, 37 - answers.length)).fill(0)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let riskLevel: "normal" | "sensitive" | "high" = "normal";
    let conclusion = "";
    let description = "";

    if (totalScore <= 12) {
      riskLevel = "normal";
      conclusion = "低度考试焦虑";
      description =
        "你的得分在 12 分或以下，属于低度考试焦虑范围。这表明你在面对考试时通常能够较好地保持放松，没有受到明显的心理负担干扰。";
    } else if (totalScore <= 20) {
      riskLevel = "sensitive";
      conclusion = "中度考试焦虑";
      description =
        "你的得分在 13 到 20 分之间，处于中度考试焦虑范围。这表示你面对考试有一定的压力反应，若能学习一些放松和情绪调节方法，通常会对发挥有帮助。";
      if (totalScore >= 15) {
        description += "（注：得分达到 15 分或以上，通常提示考试中的不适感已经比较明显。）";
      }
    } else {
      riskLevel = "high";
      conclusion = "高度考试焦虑";
      description =
        "你的得分超过 20 分，提示存在较高水平的考试焦虑。过度焦虑可能损害注意力、记忆提取和临场发挥，建议尽早尝试系统性的放松训练、情绪调节或寻求专业支持。";
    }

    return {
      totalScore,
      conclusion,
      details: {
        riskLevel,
        description,
        rule: "根据原始资料，所有回答“True”的题目数量总和即为最终考试焦虑得分。",
        TODO_PDF_CHECK:
          "PDF 原文要求直接累加 True 的总数，但第 3、15、26、27、29、33 题语义上更像低焦虑或反向描述。当前实现严格遵循 PDF 指令，未私自改为反向计分。",
      },
    };
  },
};
