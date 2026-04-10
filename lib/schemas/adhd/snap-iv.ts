import type { ExecutableScaleDefinition, LocalizedTextValue, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：生成 SNAP-IV 专用的 0-3 分选项
 */
type SNAPOptionDescriptions = [
  LocalizedTextValue?,
  LocalizedTextValue?,
  LocalizedTextValue?,
  LocalizedTextValue?,
];

const SNAP_OPTION_META = [
  {
    label: "无",
    score: 0,
    aliases: ["无", "没有", "从不", "0分"],
  },
  {
    label: "有一点点",
    score: 1,
    aliases: ["有一点点", "偶尔", "一点点", "1分"],
  },
  {
    label: "还算不少",
    score: 2,
    aliases: ["还算不少", "经常", "不少", "2分"],
  },
  {
    label: "非常多",
    score: 3,
    aliases: ["非常多", "总是", "很多", "3分"],
  },
] as const;

const createSNAPOptions = (descriptions?: SNAPOptionDescriptions) =>
  SNAP_OPTION_META.map((option, index) => ({
    label: option.label,
    score: option.score,
    aliases: [...option.aliases],
    ...(descriptions?.[index] ? { description: descriptions[index] } : {}),
  }));

// 完整 26 题 4D 结构化数据
const SNAP_QUESTIONS: ScaleQuestion[] = [
  // ─── 维度一：注意力不足 (Inattention) 题 1-9 ───
  { 
    id: 1, text: '在学习或做作业时，很难把注意力长时间集中在一件事上', 
    clinical_intent: '评估注意力维持能力',
    colloquial: '宝宝平时写作业或者画画的时候，是不是很难长时间专心做一件事？',
    fallback_examples: ['比如写不了几分钟就要起来走动，或者发呆？'],
    options: createSNAPOptions([
      '大多能专心把一件事做完，写作业、画画时不会轻易分心。',
      '偶尔会分心或坐不住，但提醒后通常还能把注意力拉回来。',
      '经常很难长时间专心，做事做到一半就走神，已经影响任务持续。',
      '几乎每天都明显难以维持专注，写作业或画画很快就会中断。',
    ]) 
  },
  { 
    id: 2, text: '在完成任务时，经常因为分心而做不完', 
    clinical_intent: '评估抗干扰能力与任务完成度',
    colloquial: '他做事是不是很容易半途而废？',
    fallback_examples: ['比如搭积木搭到一半，被旁边的事情吸引，就不搭了？'],
    options: createSNAPOptions([
      '大多数任务都能坚持做完，不会轻易半途而废。',
      '偶尔会因为分心停下来，但多数情况下还能继续完成。',
      '经常做事做到一半就被别的事吸引，任务完成度明显受影响。',
      '几乎每天都难以把事情做完，常常刚开始不久就放弃或转去做别的。'
    ]) 
  },
  { 
    id: 3, text: '看起来好像在听您说话，但其实并没有真的在听', 
    clinical_intent: '评估听觉注意力及心不在焉',
    colloquial: '您跟他说话的时候，他是不是经常像没听见，或者“左耳进右耳出”？',
    fallback_examples: ['比如刚嘱咐完他去拿个东西，他转头就忘了您说啥？'],
    options: createSNAPOptions([
      '和他说话时通常能听进去，不会总显得心不在焉。',
      '偶尔会像没听见一样，需要再提醒一次才会回应。',
      '经常听着听着就走神，别人说话像是从耳边飘过去一样。',
      '几乎每天都显得没在认真听，日常交流里经常需要反复叫回注意力。'
    ]) 
  },
  { 
    id: 4, text: '经常难以完成家庭作业或布置的任务', 
    clinical_intent: '评估任务执行与完成指令能力',
    colloquial: '老师布置的作业或者您让他做的家务，他能自己按时做完吗？',
    fallback_examples: ['是不是经常磨磨蹭蹭，或者干脆不做？'],
    options: createSNAPOptions([
      '大多数作业和家务都能按要求完成，不太需要一路盯着催。',
      '偶尔会拖拉或漏掉步骤，但提醒后一般还能做完。',
      '经常难以把家务或作业完成到底，需要多次催促和陪着做。',
      '几乎每天都很难完成布置的任务，不是拖很久就是干脆做不完。'
    ]) 
  },
  { 
    id: 5, text: '经常在做事情时表现得没有组织性，手忙脚乱', 
    clinical_intent: '评估组织计划与统筹能力',
    colloquial: '他做事是不是经常乱糟糟的，没有条理？',
    fallback_examples: ['比如书包总是乱七八糟，写作业时一会儿找橡皮一会儿找铅笔？'],
    options: createSNAPOptions([
      '做事大体有条理，物品和步骤基本能安排清楚。',
      '偶尔会有些乱，但整体还不至于明显手忙脚乱。',
      '经常显得没条理，做事和收东西都乱糟糟的。',
      '几乎每天都非常缺乏组织性，做任何事都容易一团乱。'
    ]) 
  },
  { 
    id: 6, text: '经常逃避、不喜欢或不愿意做需要持续用脑的任务', 
    clinical_intent: '评估对认知努力的逃避行为',
    colloquial: '他是不是特别反抗那些需要动脑筋的事？',
    fallback_examples: ['比如一让他写算术题或者看书，他就找各种理由推脱，比如要上厕所喝水？'],
    options: createSNAPOptions([
      '面对要动脑的任务大多还能接受，不会总想逃开。',
      '偶尔会找理由拖一拖，但通常还是能开始做。',
      '经常抗拒需要持续动脑的任务，一遇到就想躲开或推迟。',
      '几乎每天都明显回避这类任务，只要一提就强烈抵触。'
    ]) 
  },
  { 
    id: 7, text: '经常丢三落四，比如弄丢铅笔、书本、作业等', 
    clinical_intent: '评估物品保管及日常健忘',
    colloquial: '他的铅笔、橡皮或者外套是不是经常弄丢在学校里找不到了？',
    fallback_examples: ['买的新文具是不是没几天就不见了？'],
    options: createSNAPOptions([
      '学习和生活用品大多能保管好，不常丢三落四。',
      '偶尔会弄丢东西，但还不算特别频繁。',
      '经常把铅笔、书本、作业或外套弄丢，找东西成了常态。',
      '几乎每天都在丢东西，重要物品也很难持续保管好。'
    ]) 
  },
  { 
    id: 8, text: '经常被外界的小动静所吸引，容易走神', 
    clinical_intent: '评估易受外界刺激干扰的程度',
    colloquial: '旁边稍微有一点声音，比如窗外有车开过，他是不是马上就转头去看，忘了自己在干嘛？',
    fallback_examples: ['上课的时候也容易被旁边同学的小动作吸引吗？'],
    options: createSNAPOptions([
      '周围有小动静时通常还能继续当前事情，不太容易被带跑。',
      '偶尔会被旁边声音或动作吸引，但还能再回到原任务。',
      '经常被外界小刺激打断，一有动静就容易走神。',
      '几乎每天都很容易被周围环境带走注意力，很难稳住。'
    ]) 
  },
  { 
    id: 9, text: '在日常生活中经常表现出健忘，比如忘记约定的事情', 
    clinical_intent: '评估日常前瞻性记忆',
    colloquial: '您早上嘱咐他的事，比如放学带什么东西回来，他是不是经常忘得一干二净？',
    fallback_examples: ['日常家里规定好的规矩，是不是也总是转头就忘？'],
    options: createSNAPOptions([
      '日常交代的事情大多记得住，不会总是转头就忘。',
      '偶尔会忘掉答应的事或提醒内容，但不算常态。',
      '经常把约定、提醒或家里规矩忘得一干二净。',
      '几乎每天都明显健忘，生活里反复出现“刚说完就忘”的情况。'
    ]) 
  },

  // ─── 维度二：多动/冲动 (Hyperactivity/Impulsivity) 题 10-18 ───
  { 
    id: 10, text: '在座位上经常坐不住，手脚扭来扭去或不停摆弄东西', 
    clinical_intent: '评估局部的运动性不安',
    colloquial: '他坐在椅子上的时候，是不是总喜欢扭来扭去，手脚闲不住？',
    fallback_examples: ['吃饭或者写作业时也是手里总想抠点什么？'],
    options: createSNAPOptions([
      '坐着时大体能稳住身体，不会一直扭来扭去或停不下来。',
      '偶尔会有些小动作多，但多数时候还能坐住。',
      '经常在座位上扭动、摆弄手脚，明显显得坐不安稳。',
      '几乎每天都坐不住，手脚一直闲不下来，别人很容易看出来。'
    ]) 
  },
  { 
    id: 11, text: '在课堂上或需要安静的场合，经常离开座位跑来跑去', 
    clinical_intent: '评估规则意识缺失及冲动性起立',
    colloquial: '上课或者在外面吃饭需要坐在位子上的时候，他会经常自己站起来离开座位到处乱跑吗？',
    fallback_examples: ['是不是感觉管不住自己的腿？'],
    options: createSNAPOptions([
      '该坐着的时候大多能留在座位上，不会老是自己跑开。',
      '偶尔会起身离开座位，但提醒后通常还能回来。',
      '经常在该坐着的时候自己跑开，明显管不住离座行为。',
      '几乎每天都很难待在座位上，坐一会儿就要起身乱跑。'
    ]) 
  },
  { 
    id: 12, text: '在应该安静的场合，经常过度地跑跳攀爬', 
    clinical_intent: '评估场景不适宜的过度活动',
    colloquial: '带他去如图书馆、餐厅这些需要安静的地方，他还是会跑来跑去、爬上爬下吗？',
    fallback_examples: ['有时候怎么拉都拉不住他？'],
    options: createSNAPOptions([
      '在需要安静的场合大多能控制跑跳攀爬，不会特别失控。',
      '偶尔会在不合适的场合多动，但整体还算可控。',
      '经常在安静场合也跑来跑去、爬上爬下，明显不合时宜。',
      '几乎每天都在不该活动的场合过度跑跳攀爬，很难拦住。'
    ]) 
  },
  { 
    id: 13, text: '很难安静地玩耍或参与需要安静的活动', 
    clinical_intent: '评估休闲活动中的多动表现',
    colloquial: '他平时在家里玩积木或者看书，能安安静静地待一会儿吗？',
    fallback_examples: ['还是玩任何东西都会弄出很大动静，甚至大喊大叫？'],
    options: createSNAPOptions([
      '玩耍或看书时通常能安静一会儿，不会总把场面搞得很吵。',
      '偶尔会安静不下来，但多数情况下还能短时间稳住。',
      '经常难以安静玩耍，做什么都容易弄出很大动静。',
      '几乎每天都完全静不下来，安静活动常常很快就被打断。'
    ]) 
  },
  { 
    id: 14, text: '总是动个不停，就像装了马达一样', 
    clinical_intent: '评估整体的持续性多动水平',
    colloquial: '您感觉他是不是一天到晚精力旺盛，就像装了小马达一样停不下来？',
    fallback_examples: ['有时候是不是连到了晚上该睡觉的时候，还在兴奋地动？'],
    options: createSNAPOptions([
      '整体活动量和同龄孩子差不多，不会一直像停不下来一样。',
      '偶尔会特别兴奋好动，但不是持续一整天都这样。',
      '经常像装了马达一样停不下来，活动量明显偏高。',
      '几乎每天都持续性过度好动，从早到晚都很难安静下来。'
    ]) 
  },
  { 
    id: 15, text: '经常话太多，说个不停', 
    clinical_intent: '评估言语多动',
    colloquial: '他平时是不是话特别多，小嘴吧啦吧啦说个不停？',
    fallback_examples: ['有时候即使别人不理他，他也能一个人说很久，显得有点吵？'],
    options: createSNAPOptions([
      '说话量大体正常，不会总是连续说个不停。',
      '偶尔会比别人话多一点，但不至于一直停不下来。',
      '经常话很多，很难自己停下来，别人会觉得有些吵。',
      '几乎每天都说个不停，明显超出同龄孩子的正常说话量。'
    ]) 
  },
  { 
    id: 16, text: '经常在别人问题还没说完时就抢答', 
    clinical_intent: '评估言语冲动性与延迟反应困难',
    colloquial: '别人问他问题，或者大人的话还没说完，他是不是就急着抢答或者插嘴？',
    fallback_examples: ['甚至有时候问题没听完，答非所问就开始说？'],
    options: createSNAPOptions([
      '通常能等别人把问题说完，不太会急着抢答。',
      '偶尔会插嘴或抢着说，但多数时候还能控制。',
      '经常在别人没说完时就抢答或插嘴，显得很冲动。',
      '几乎每天都忍不住抢答，问题没听完就急着说出口。'
    ]) 
  },
  { 
    id: 17, text: '在轮流做游戏或活动时，很难耐心等待', 
    clinical_intent: '评估延迟满足能力与规则遵守',
    colloquial: '跟别的小朋友一起玩滑梯或者排队的时候，他能耐心排队等吗？',
    fallback_examples: ['是不是总想插队，轮不到自己就急眼？'],
    options: createSNAPOptions([
      '轮流排队或等待时大多还能忍住，不会总是急着抢先。',
      '偶尔会等得不耐烦，但通常还能勉强守住顺序。',
      '经常很难耐心等待轮到自己，排队或轮流时容易急眼。',
      '几乎每天都明显不能等，轮流活动里总想立刻轮到自己。'
    ]) 
  },
  { 
    id: 18, text: '经常打断别人的谈话或活动', 
    clinical_intent: '评估社交冲动与边界感缺失',
    colloquial: '大人正在聊天，或者别的小朋友正在玩，他是不是经常突然插嘴或者冲进去打断？',
    fallback_examples: ['显得有些唐突，不懂得等别人说完？'],
    options: createSNAPOptions([
      '通常能等别人聊完或玩完，不会老去打断别人的活动。',
      '偶尔会插进别人的谈话或游戏，但不算频繁。',
      '经常打断别人说话或活动，显得边界感比较弱。',
      '几乎每天都很容易冲进去打断别人，别人常因此被干扰。'
    ]) 
  },

  // ─── 维度三：对立违抗 (Oppositional Defiant) 题 19-26 ───
  { 
    id: 19, text: '经常因为一点小事就发脾气', 
    clinical_intent: '评估情绪反应易激惹',
    colloquial: '他是不是经常因为一点点不顺心的小事就大发脾气？',
    fallback_examples: ['比如没按他的意思放东西，或者不给他买零食，就撒泼打滚？'],
    options: createSNAPOptions([
      '大多时候情绪还算稳，不会因为一点小事就马上爆发。',
      '偶尔会因为小事发脾气，但通常还能比较快平复。',
      '经常因为小事大发脾气，家里人会明显感到难以应对。',
      '几乎每天都很容易因小事爆发情绪，发脾气频繁而且很强。'
    ]) 
  },
  { 
    id: 20, text: '经常和大人争吵', 
    clinical_intent: '评估权威挑战与对抗性',
    colloquial: '您或者老师批评他、管教他的时候，他是不是经常顶嘴、跟大人吵架？',
    fallback_examples: ['一点都不服软，非要争个高下？'],
    options: createSNAPOptions([
      '被批评或管教时多数还能听进去，不会总和大人争吵。',
      '偶尔会顶嘴争辩，但还不算明显对抗。',
      '经常和大人争吵、顶嘴，对管教反应很强烈。',
      '几乎每天都明显跟大人对着干，争吵成了常见互动方式。'
    ]) 
  },
  { 
    id: 21, text: '经常主动拒绝或反抗大人的要求', 
    clinical_intent: '评估对指令的主动违抗',
    colloquial: '您让他去做一件很简单的事（比如洗手吃饭），他是不是经常故意不听，甚至直接拒绝您？',
    fallback_examples: ['就是偏偏要跟大人对着干？'],
    options: createSNAPOptions([
      '对大人的要求大多还能配合，不会故意长期反抗。',
      '偶尔会闹点小别扭，但提醒后通常还能去做。',
      '经常故意不听或直接拒绝要求，明显爱和大人对着干。',
      '几乎每天都会主动反抗指令，家长一提要求就容易僵住。'
    ]) 
  },
  { 
    id: 22, text: '经常故意做一些让别人不高兴的事情', 
    clinical_intent: '评估挑衅与滋事行为',
    colloquial: '他会不会故意去做一些明知道惹您或者同学不高兴的事？',
    fallback_examples: ['比如故意去推倒别人搭好的积木，看别人生气？'],
    options: createSNAPOptions([
      '一般不会故意去惹别人生气，和人相处还算有分寸。',
      '偶尔会做点惹人不高兴的小动作，但不算常态。',
      '经常故意做些让别人不舒服或生气的事，带有挑衅意味。',
      '几乎每天都会故意惹别人，明显享受或不在乎他人的恼火反应。'
    ]) 
  },
  { 
    id: 23, text: '经常因为自己的错误而责怪别人', 
    clinical_intent: '评估推卸责任与外归因倾向',
    colloquial: '明明是他自己做错了事（比如打碎了东西），他是不是经常赖在别人头上，或者怪别人没放好？',
    fallback_examples: ['总是找各种借口，就是不肯认错？'],
    options: createSNAPOptions([
      '做错事时大多还能承认，不会总把责任推给别人。',
      '偶尔会找借口推脱，但多数时候还能讲清楚自己的问题。',
      '经常把自己的错误怪到别人头上，很难直接认错。',
      '几乎每天都明显推卸责任，出了问题总先怪别人。'
    ]) 
  },
  { 
    id: 24, text: '经常对别人特别敏感，很容易被激怒', 
    clinical_intent: '评估人际过度敏感',
    colloquial: '别的小朋友不小心碰到他，或者开个小玩笑，他是不是很容易就急眼或者发火？',
    fallback_examples: ['就像个小炸药包一样，点火就着？'],
    options: createSNAPOptions([
      '和别人相处时大多还能放松，不会特别容易被激怒。',
      '偶尔会有些敏感，但还不至于一点就炸。',
      '经常因为别人的碰触、玩笑或一句话就被激怒。',
      '几乎每天都非常容易被惹火，人际互动里像随时会点着一样。'
    ]) 
  },
  { 
    id: 25, text: '经常生气或充满敌意', 
    clinical_intent: '评估负面情绪基调',
    colloquial: '您感觉他平时是不是经常气鼓鼓的，看谁都不顺眼，带着点敌意？',
    fallback_examples: ['总是觉得周围的同学或者老师在针对他？'],
    options: createSNAPOptions([
      '整体情绪基调还算平稳，不会总带着明显敌意或怒气。',
      '偶尔会显得气鼓鼓的，但不是大多数时间都这样。',
      '经常带着怒气或敌意，看谁都不顺眼的感觉比较明显。',
      '几乎每天都处在生气或敌对状态，负面情绪底色很重。'
    ]) 
  },
  { 
    id: 26, text: '经常心怀怨恨或想要报复', 
    clinical_intent: '评估报复心理',
    colloquial: '如果有小朋友得罪了他，他是不是记仇记很久，甚至总想着找机会报复回来？',
    fallback_examples: ['经常狠狠地说“我要打他”之类的话？'],
    options: createSNAPOptions([
      '和别人有矛盾后大多还能过去，不会一直记仇想着报复。',
      '偶尔会记仇一阵子，但通常过后还能放下。',
      '经常记恨别人，反复提起并想找机会报复回来。',
      '几乎每天都带着怨恨，明显有很强的报复念头或报复言行。'
    ]) 
  }
];

export const SNAP_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "SNAP-IV",
  version: "1.0",  // ✅ 新增版本号
  title: {
    zh: "注意缺陷多动障碍筛查量表 (SNAP-IV-26)",
    en: "SNAP-IV ADHD Rating Scale"
  },
  description: {
    zh: "用于评估儿童及青少年注意力缺陷、多动/冲动以及对立违抗行为的严重程度。分为三个独立维度计分。",
    en: "A scale for assessing attention deficit, hyperactivity/impulsivity, and oppositional symptoms."
  },
  category: "Child Development",
  tags: ["儿童发育", "ADHD", "多动", "注意力"],
  interactionMode: "voice_guided",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: true,
  questions: SNAP_QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    // 确保答案长度正确，避免截取错误
    const safeAnswers = answers.length === 26 ? answers : [...answers, ...Array(26 - answers.length).fill(0)];
    
    // 核心逻辑：精准切割三个维度的子分数
    const inattentionScore = safeAnswers.slice(0, 9).reduce((sum, s) => sum + s, 0);       // 注意力不足 (题1-9)
    const hyperactivityScore = safeAnswers.slice(9, 18).reduce((sum, s) => sum + s, 0);    // 多动/冲动 (题10-18)
    const oddScore = safeAnswers.slice(18, 26).reduce((sum, s) => sum + s, 0);             // 对立违抗 (题19-26)
    
    const totalScore = inattentionScore + hyperactivityScore + oddScore;

    let conclusion: string;
    let detailsStr = `【注意力得分】: ${inattentionScore}/27 (≥13分提示异常)\n【多动冲动得分】: ${hyperactivityScore}/27 (≥13分提示异常)\n【对立违抗得分】: ${oddScore}/24 (≥8分提示异常)\n\n`;

    // 临床标准：任意一个维度的子分数达标，即具有临床意义
    if (inattentionScore >= 13 || hyperactivityScore >= 13 || oddScore >= 8) {
      conclusion = "疑似存在明显 ADHD 症状";
      detailsStr += "临床建议：发现存在核心维度的显著偏高，强烈建议寻求儿童精神科或发育行为科专业医师进行全面评估与干预。";
    } else if (totalScore >= 20) {
      // 若子分未达标，但总分较高，提示临界状态
      conclusion = "临界/轻微症状";
      detailsStr += "临床建议：存在部分注意力不集中、多动或违抗表现，建议结合儿童日常表现持续观察，尝试调整教养方式，必要时咨询专业人士。";
    } else {
      conclusion = "正常范围";
      detailsStr += "临床建议：目前评估结果在正常范围内，未见明显的注意力缺陷、多动或对立违抗核心症状。";
    }

    return { 
      totalScore, 
      conclusion, 
      details: {
        dimensions: {
          inattention: inattentionScore,
          hyperactivity: hyperactivityScore,
          oppositionalDefiant: oddScore
        },
        description: detailsStr
      } 
    };
  }
};
