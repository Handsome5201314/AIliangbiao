import type { ScaleDefinition, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：生成 SRS 专用的 1-4 分选项
 * @param isReverse 是否为反向计分题 (表现越好，得分越低)
 */
const createSRSOptions = (isReverse = false) => {
  if (isReverse) {
    return [
      { label: "从不 (得4分)", score: 4 },
      { label: "偶尔 (得3分)", score: 3 },
      { label: "经常 (得2分)", score: 2 },
      { label: "总是 (得1分)", score: 1 }
    ];
  }
  return [
    { label: "从不 (得1分)", score: 1 },
    { label: "偶尔 (得2分)", score: 2 },
    { label: "经常 (得3分)", score: 3 },
    { label: "总是 (得4分)", score: 4 }
  ];
};

// 完整 65 题 4D 结构化数据 (完美处理正反向计分映射)
const SRS_QUESTIONS: ScaleQuestion[] = [
  { id: 1, text: '在社交场合较独处时表现得明显烦躁。', clinical_intent: '评估社交回避与环境不耐受', colloquial: '宝宝在人多的地方或者跟别人在一起时，是不是比他一个人呆着的时候更容易烦躁、发脾气？', fallback_examples: ['比如带他去走亲戚或者游乐场，他会不会显得特别不耐烦？'], options: createSRSOptions(false) },
  { id: 2, text: '面部表情与当时说话情节不符。', clinical_intent: '评估情感表达协调性', colloquial: '他说话时候的表情自然吗？会不会有时候说着难过的事却在笑？', fallback_examples: ['脸上的表情和他说的话能对得上吗？'], options: createSRSOptions(false) },
  { id: 3, text: '与别人互动时表现得很自信。', clinical_intent: '评估社交自信度 (反向计分)', colloquial: '宝宝跟别人交流或者一起玩的时候，表现得大方自信吗？', fallback_examples: ['遇到不认识的小朋友，他敢主动过去打招呼吗？'], options: createSRSOptions(true) },
  { id: 4, text: '当受到压力时表现出固定奇特的行为方式。', clinical_intent: '评估压力下的刻板行为', colloquial: '遇到困难或者有压力的时候，他会不会有一些奇怪的固定小动作？', fallback_examples: ['比如一紧张就一直搓手、转圈圈？'], options: createSRSOptions(false) },
  { id: 5, text: '不会意识到被别人利用。', clinical_intent: '评估社交常识与自我保护', colloquial: '他是不是经常傻乎乎的，就算被别的小朋友欺负或者占便宜了也不知道？', fallback_examples: ['别人拿好东西骗他的玩具，他是不是也会轻易给？'], options: createSRSOptions(false) },
  { id: 6, text: '宁愿一个人呆着也不愿意与别人一起呆着。', clinical_intent: '评估社交动机缺乏', colloquial: '他是不是更喜欢一个人玩，哪怕旁边有很多小朋友，他也不愿意凑过去？', fallback_examples: ['是不是觉得跟别人玩还不如自己玩有意思？'], options: createSRSOptions(false) },
  { id: 7, text: '能意识到别人的想法和感觉。', clinical_intent: '评估心理理论与共情 (反向计分)', colloquial: '他能感觉到您或者别人的情绪吗？比如您今天不高兴，他能看出来吗？', fallback_examples: ['他能不能猜到别的小朋友想要什么？'], options: createSRSOptions(true) },
  { id: 8, text: '行为方式独特，奇怪。', clinical_intent: '评估行为特异性', colloquial: '您或者别人是不是经常觉得，这孩子有些举动挺古怪、跟常人不太一样的？', fallback_examples: ['有没有什么特别不合群的举动？'], options: createSRSOptions(false) },
  { id: 9, text: '粘着大人，对他们十分依赖。', clinical_intent: '评估过度依恋或分离焦虑', colloquial: '他是不是特别粘着您或者家里的大人，像个小尾巴一样走哪跟哪？', fallback_examples: ['哪怕是一会儿不见都不行？'], options: createSRSOptions(false) },
  { id: 10, text: '只能理解谈话的字面意思，不能理解其真正含义。', clinical_intent: '评估隐喻及语用理解障碍', colloquial: '他听别人说话，是不是只能听懂表面的意思？听不懂开玩笑或者话里有话？', fallback_examples: ['比如您说“太阳打西边出来了”，他会不会真的去看西边？'], options: createSRSOptions(false) },
  { id: 11, text: '很有自信。', clinical_intent: '评估整体自信心 (反向计分)', colloquial: '平时在生活中，他总体来说是个自信的孩子吗？', fallback_examples: ['做事或者说话的时候畏缩吗？'], options: createSRSOptions(true) },
  { id: 12, text: '能够向别人传达自己的感受。', clinical_intent: '评估情绪表达能力 (反向计分)', colloquial: '他开心、难过或者害怕的时候，能清楚地告诉别人他的感受吗？', fallback_examples: ['能不能说出“妈妈我今天很难过”这样的话？'], options: createSRSOptions(true) },
  { id: 13, text: '与同伴交谈时显得笨拙(例如在交谈时不懂得轮流说话)。', clinical_intent: '评估会话轮替与语用笨拙', colloquial: '他跟小朋友聊天的时候，是不是显得有点笨拙？比如不懂得你一句我一句，总是一个人一直说？', fallback_examples: ['或者经常在别人说话中间生硬地打断？'], options: createSRSOptions(false) },
  { id: 14, text: '不能很好地与别人合作。', clinical_intent: '评估协同合作能力', colloquial: '跟别的小朋友一起搭积木或者玩游戏，他能跟别人好好配合吗？', fallback_examples: ['还是非要按他自己的规矩来，完全不顾别人？'], options: createSRSOptions(false) },
  { id: 15, text: '能理解别人的语调及面部表情的意思。', clinical_intent: '评估非言语线索解读 (反向计分)', colloquial: '您说话的语气重一点，或者拉下脸不高兴，他能察觉到您的意思吗？', fallback_examples: ['他能听出大人生气或者开玩笑的语气吗？'], options: createSRSOptions(true) },
  { id: 16, text: '避免目光接触或有不正常的目光接触。', clinical_intent: '评估眼神交流异常', colloquial: '别人跟他说话的时候，他会不会故意躲闪别人的眼睛不看？或者盯着人看的方式很奇怪？', fallback_examples: ['跟人对视的时间是不是特别短？'], options: createSRSOptions(false) },
  { id: 17, text: '能意识到事情的不公平。', clinical_intent: '评估公平感与社交规范 (反向计分)', colloquial: '如果分苹果分得不均匀，或者别人插队，他能意识到这样是不公平的吗？', fallback_examples: ['他会有“这不公平”这样的概念吗？'], options: createSRSOptions(true) },
  { id: 18, text: '即使很努力，但是也很难与别人做朋友。', clinical_intent: '评估建立友谊的困难程度', colloquial: '他是不是很想交朋友，也很努力地去尝试了，但就是交不到好朋友？', fallback_examples: ['别人似乎很难接纳他？'], options: createSRSOptions(false) },
  { id: 19, text: '在谈话中想理解别人的意思时受挫。', clinical_intent: '评估社交理解迟缓', colloquial: '别人跟他说一长串话，他是不是经常显得很迷茫，理解起来很费劲？', fallback_examples: ['经常需要大人跟他解释好几遍别人刚才说了什么？'], options: createSRSOptions(false) },
  { id: 20, text: '有不同寻常的感官兴趣(喃喃自语，旋转物体)或特别的玩玩具的方式。', clinical_intent: '评估异常感官寻求与刻板行为', colloquial: '他玩玩具的方式是不是很特别？比如不玩小汽车，非要盯着车轮转，或者一个人嘀嘀咕咕？', fallback_examples: ['对某些特定的声音或者旋转的东西特别着迷？'], options: createSRSOptions(false) },
  { id: 21, text: '能够模仿别人的动作。', clinical_intent: '评估动作模仿能力 (反向计分)', colloquial: '您做个动作，比如挥手或者拍肚子，他能跟着学出来吗？', fallback_examples: ['模仿得像不像？'], options: createSRSOptions(true) },
  { id: 22, text: '与同年人能够正常，恰当地玩耍。', clinical_intent: '评估同伴游戏能力 (反向计分)', colloquial: '他跟同龄的小朋友在一起玩的时候，表现得正常、合群吗？', fallback_examples: ['能不能融入孩子们的游戏里？'], options: createSRSOptions(true) },
  { id: 23, text: '除非叫他去，否则不参加集体活动。', clinical_intent: '评估社交发起被动', colloquial: '如果不特意去叫他，他是不是从来不会主动加入别的小朋友的游戏圈子？', fallback_examples: ['总是喜欢在旁边看着，不主动去玩？'], options: createSRSOptions(false) },
  { id: 24, text: '较之其他儿童，他(她)很难接受常规的改变。', clinical_intent: '评估对同一性的坚持', colloquial: '如果家里临时改变了计划，或者每天出门的路线变了，他是不是比别的小孩更难接受，甚至发脾气？', fallback_examples: ['是不是对自己的“老规矩”特别固执？'], options: createSRSOptions(false) },
  { id: 25, text: '不介意与别人不同步或与别人不同调。', clinical_intent: '评估社交顺应性缺失', colloquial: '大家都在做一件事（比如唱歌），他一个人在旁边干别的，他会觉得不好意思或者不自在吗？', fallback_examples: ['是不是完全不在乎自己跟别人不一样？'], options: createSRSOptions(false) },
  { id: 26, text: '当别人伤心时能安慰别人。', clinical_intent: '评估共情与安慰行为 (反向计分)', colloquial: '看到您或者别的小朋友哭了，他会走过去安慰，比如拍拍或者拿纸巾吗？', fallback_examples: ['他懂得关心别人的难过吗？'], options: createSRSOptions(true) },
  { id: 27, text: '避免与同伴或成人开始社会交往。', clinical_intent: '评估主动社交回避', colloquial: '遇到认识的同学或者长辈，他是不是故意躲开，不愿意去打招呼说话？', fallback_examples: ['总是有意避开跟人打交道的机会？'], options: createSRSOptions(false) },
  { id: 28, text: '重复地想或重复谈论一样东西。', clinical_intent: '评估狭隘兴趣及刻板言语', colloquial: '他是不是对某一样东西（比如恐龙、地铁路线）特别痴迷，翻来覆去地总说这个？', fallback_examples: ['不管别人愿不愿意听，他都要一直说？'], options: createSRSOptions(false) },
  { id: 29, text: '被其他儿童认为古怪或奇特。', clinical_intent: '评估同伴接纳度', colloquial: '别的小朋友会不会觉得他是个“怪小孩”？', fallback_examples: ['会不会因为他有些举动奇怪，别人不愿意跟他玩？'], options: createSRSOptions(false) },
  { id: 30, text: '在一个复杂(很多事情同时发生)的环境中变得不高兴。', clinical_intent: '评估环境刺激过载反应', colloquial: '在人很多、很吵、有很多事情发生的地方（比如商场大促），他会不会显得很不高兴或者受不了？', fallback_examples: ['是不是这种环境会让他不知所措甚至崩溃？'], options: createSRSOptions(false) },
  { id: 31, text: '他(她)一旦开始想一件事就会一直坚持想下去。', clinical_intent: '评估认知刻板与思维固着', colloquial: '他是不是一旦钻进牛角尖，认准了一件事，怎么劝都劝不出来？', fallback_examples: ['脑子里的想法是不是很难拐弯？'], options: createSRSOptions(false) },
  { id: 32, text: '个人卫生好。', clinical_intent: '评估自我照料意识 (反向计分)', colloquial: '他平时在家里会注意自己的个人卫生吗？比如饭前洗手、衣服弄脏了会要求换？', fallback_examples: ['邋里邋遢的还是比较爱干净？'], options: createSRSOptions(true) },
  { id: 33, text: '在交往时即使他努力尝试礼貌，但是仍先得笨拙无礼。', clinical_intent: '评估社交礼仪执行的刻板性', colloquial: '有时候他明明想表现得有礼貌，但做出来的举动却让人觉得有点生硬、甚至显得没礼貌？', fallback_examples: ['比如大声生硬地喊“谢谢”，或者在不恰当的时候鞠躬？'], options: createSRSOptions(false) },
  { id: 34, text: '逃避想亲近他(她)的人。', clinical_intent: '评估身体与情感的亲密回避', colloquial: '如果有亲戚朋友想抱抱他、亲近他，他是不是会故意躲开或者推开别人？', fallback_examples: ['是不是很抗拒别人的亲热？'], options: createSRSOptions(false) },
  { id: 35, text: '不能维持正常的交谈。', clinical_intent: '评估对话维持能力', colloquial: '他能跟您一问一答、正常地聊上几个回合吗？', fallback_examples: ['是不是经常只回答一句，天就被“聊死”了，没法继续聊下去？'], options: createSRSOptions(false) },
  { id: 36, text: '与成人交流有困难。', clinical_intent: '评估跨代际交流障碍', colloquial: '他跟大人说话、沟通的时候，显得困难吗？', fallback_examples: ['是不是大人的话他听不懂，他的话大人也觉得奇怪？'], options: createSRSOptions(false) },
  { id: 37, text: '与同伴交流有困难。', clinical_intent: '评估同伴交流障碍', colloquial: '他跟同龄的小朋友沟通起来有困难吗？', fallback_examples: ['是不是经常跟小朋友鸡同鸭讲，玩不到一块去？'], options: createSRSOptions(false) },
  { id: 38, text: '当别人的情绪改变时能有恰当的反应。', clinical_intent: '评估情绪敏感度及回应 (反向计分)', colloquial: '当别人的情绪突然变了（比如从高兴变成生气），他能立刻察觉并且做出恰当的反应吗？', fallback_examples: ['比如大人发火了，他知道害怕或者收敛吗？'], options: createSRSOptions(true) },
  { id: 39, text: '有不寻常，狭隘的兴趣。', clinical_intent: '评估局限的特殊兴趣', colloquial: '他是不是对一些特别冷门或者奇怪的东西很感兴趣？', fallback_examples: ['比如不喜欢玩具，偏偏喜欢收集瓶盖或者研究天气预报？'], options: createSRSOptions(false) },
  { id: 40, text: '富有想象力，会假装(不脱离实际的)。', clinical_intent: '评估象征性游戏能力 (反向计分)', colloquial: '他平时玩的时候想象力丰富吗？会玩“过家家”这种假装游戏吗？', fallback_examples: ['比如拿个香蕉假装当电话打？'], options: createSRSOptions(true) },
  { id: 41, text: '毫无目的地在两个活动之间走动。', clinical_intent: '评估活动组织与目的性缺失', colloquial: '他会不会经常在家里瞎转悠，从这边走到那边，也不知道他到底要干嘛？', fallback_examples: ['感觉像无头苍蝇一样没有目的地晃荡？'], options: createSRSOptions(false) },
  { id: 42, text: '对声音，质地或气味非常敏感。', clinical_intent: '评估感官防御与高敏', colloquial: '他是不是对某些声音、衣服的材质或者气味特别敏感，甚至觉得难以忍受？', fallback_examples: ['比如受不了衣服领子上的标签，或者听到某种电器声就捂耳朵？'], options: createSRSOptions(false) },
  { id: 43, text: '容易与抚养者分开。', clinical_intent: '评估安全依恋 (反向计分)', colloquial: '如果要把他放在亲戚家或者送去幼儿园跟您分开，他能比较容易地适应吗？', fallback_examples: ['还是会哭闹得撕心裂肺很久？'], options: createSRSOptions(true) },
  { id: 44, text: '不能理解事件的互相关系(例如因果关系)，而同龄人可以。', clinical_intent: '评估逻辑及因果理解迟缓', colloquial: '他是不是很难理解事情的因果关系？比如“因为下雨了，所以要打伞”，别的小孩懂，他却想不明白？', fallback_examples: ['是不是觉得他经常搞不清前因后果？'], options: createSRSOptions(false) },
  { id: 45, text: '能注意别人看或听的地方。', clinical_intent: '评估共同注意 (反向计分)', colloquial: '您转头看向窗外，或者指着天上的一只鸟，他会顺着您的视线一起看过去吗？', fallback_examples: ['能不能跟您一起关注同一个东西？'], options: createSRSOptions(true) },
  { id: 46, text: '有过度严肃的面部表情。', clinical_intent: '评估面部表情僵化', colloquial: '他平时脸上的表情是不是经常特别严肃，像个小大人一样绷着脸？', fallback_examples: ['很少有孩子那种轻松调皮的表情？'], options: createSRSOptions(false) },
  { id: 47, text: '表现得很傻或突然大笑。', clinical_intent: '评估情绪失调与突发性怪笑', colloquial: '他会不会突然毫无原因地傻笑，或者做一些看起来有点傻的举动？', fallback_examples: ['明明没有什么好笑的事，他却在旁边咯咯笑？'], options: createSRSOptions(false) },
  { id: 48, text: '有幽默感，能理解笑话。', clinical_intent: '评估幽默感及高级语用 (反向计分)', colloquial: '他懂幽默吗？别人讲个笑话，他能听懂笑点并且跟着笑吗？', fallback_examples: ['还是总是当真，听不出别人在开玩笑？'], options: createSRSOptions(true) },
  { id: 49, text: '对一些任务完成得极好，但大多数任务不能完成得同样好。', clinical_intent: '评估能力发展的不均衡（孤岛能力）', colloquial: '他是不是在某几件事上表现得像个天才，但普通孩子都会做的大部分事，他却做不好？', fallback_examples: ['偏科现象极其严重？'], options: createSRSOptions(false) },
  { id: 50, text: '有重复的奇怪的行为如拍手或摇晃。', clinical_intent: '评估明显的运动刻板行为', colloquial: '他会不会经常有规律地拍手、摇晃身体或者做一些重复的奇怪小动作？', fallback_examples: ['这种动作经常出现吗？'], options: createSRSOptions(false) },
  { id: 51, text: '不能直接地回答问题且答非所问。', clinical_intent: '评估会话连贯性受损', colloquial: '问他一个问题，他是不是经常拐弯抹角，或者回答的内容跟您问的完全不搭界？', fallback_examples: ['比如问他“今天吃了什么”，他却回答“奥特曼打怪兽”？'], options: createSRSOptions(false) },
  { id: 52, text: '会察觉他(她)正在大声谈话或制造了噪音。', clinical_intent: '评估自我意识与社交监控 (反向计分)', colloquial: '如果他说话声音太大了，或者弄出了很响的噪音，他自己能意识到并且收敛一点吗？', fallback_examples: ['还是完全不管不顾，不知道自己吵到别人了？'], options: createSRSOptions(true) },
  { id: 53, text: '用奇怪的语调与人谈话(如像机器人说话或在演讲)。', clinical_intent: '评估言语韵律异常', colloquial: '他说话的语调听起来奇怪吗？比如像机器人的声音平平的，或者像新闻播音员一样拿腔拿调？', fallback_examples: ['语气很不自然，缺乏感情色彩？'], options: createSRSOptions(false) },
  { id: 54, text: '对人的反应好像把人当物体。', clinical_intent: '评估人际互动物化', colloquial: '他把您或者别人当成工具人吗？比如想拿高处的东西，直接拉着您的手去拿，却根本不看您？', fallback_examples: ['感觉他需要的是您的手，而不是您这个人？'], options: createSRSOptions(false) },
  { id: 55, text: '能意识到他(她)太靠近别人或侵犯了别人的空间。', clinical_intent: '评估个人空间边界感 (反向计分)', colloquial: '他跟别人说话或者站着的时候，懂得保持一点社交距离吗？', fallback_examples: ['还是经常毫无顾忌地几乎贴到别人脸上或者身上？'], options: createSRSOptions(true) },
  { id: 56, text: '会走到两个正在谈话的人中间。', clinical_intent: '评估社交规则的冒犯', colloquial: '大人正在讲话，他会不会毫不顾忌地直接穿过去，或者站到中间把人隔开？', fallback_examples: ['完全不懂得避让正在交流的人？'], options: createSRSOptions(false) },
  { id: 57, text: '经常被嘲弄。', clinical_intent: '评估同伴霸凌及社交弱势', colloquial: '在学校或者小区里，他是不是经常被别的小朋友取笑或者欺负？', fallback_examples: ['成了大家嘲弄的对象？'], options: createSRSOptions(false) },
  { id: 58, text: '对事物的部分过于专注而忽视了整体。', clinical_intent: '评估局部视觉偏好（弱中央统合）', colloquial: '看一个东西的时候，他是不是只死盯着一个局部看？比如看小汽车只盯着轮子，却不管整辆车？', fallback_examples: ['只见树木不见森林？'], options: createSRSOptions(false) },
  { id: 59, text: '多疑。', clinical_intent: '评估偏执与防御心理', colloquial: '他平时心思重吗？会不会经常觉得别人要害他、或者在背地里说他坏话？', fallback_examples: ['对别人的好意也经常怀疑？'], options: createSRSOptions(false) },
  { id: 60, text: '感情淡漠，不表达她(他)的感受。', clinical_intent: '评估情感冷漠与述情障碍', colloquial: '他看起来是不是冷冰冰的，没什么感情波动，也很少跟您说他的心里话或感受？', fallback_examples: ['就像个没有情绪波动的小石头？'], options: createSRSOptions(false) },
  { id: 61, text: '固执，要改变他(她)的想法很难。', clinical_intent: '评估认知刻板与妥协困难', colloquial: '他脾气轴吗？一旦认定的事情，是不是十头牛都拉不回来？', fallback_examples: ['极其固执，绝对不肯听别人的劝改变主意？'], options: createSRSOptions(false) },
  { id: 62, text: '做事的原因很特别或不合逻辑。', clinical_intent: '评估行为逻辑异常', colloquial: '他做一些事情的理由，是不是经常让您觉得匪夷所思、很不符合常理？', fallback_examples: ['比如把鞋子放在冰箱里，理由却极其奇怪？'], options: createSRSOptions(false) },
  { id: 63, text: '与他人接触时方式很特别(如碰碰别人后不说话走开)。', clinical_intent: '评估奇异的社交发起方式', colloquial: '他跟别人打交道的方式奇怪吗？比如跑过去摸一下别人，然后一句话不说就跑了？', fallback_examples: ['让人摸不着头脑的互动方式？'], options: createSRSOptions(false) },
  { id: 64, text: '在社交场合中特别紧张。', clinical_intent: '评估社交焦虑反应', colloquial: '带他去人多或者不熟悉的聚会场合，他会不会表现得极其紧张、局促不安？', fallback_examples: ['手心出汗或者躲在您身后不敢出来？'], options: createSRSOptions(false) },
  { id: 65, text: '无目的地凝视或注视。', clinical_intent: '评估发呆与环境抽离', colloquial: '他会不会经常两眼发直，盯着空气或者某个地方发呆，也不知道在看什么？', fallback_examples: ['叫他好几声都回不过神来？'], options: createSRSOptions(false) }
];

export const SRS_Scale: ScaleDefinition = {
  id: "SRS",
  version: "1.0",  // ✅ 新增版本号
  title: "社交反应量表 (SRS)",
  description: "用于评估儿童在自然社会环境中的社交互动能力，识别孤独症谱系障碍相关的社交缺陷。共65题。",
  questions: SRS_QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    // 补齐答案长度，防止意外越界
    const safeAnswers = answers.length === 65 ? answers : [...answers, ...Array(65 - answers.length).fill(1)];
    
    // 感谢 4D 架构中的 createSRSOptions() 函数自动处理了反向计分映射！
    // 这里的引擎代码依旧保持最干净的累加逻辑。
    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let conclusion: string;
    let detailsStr = `【总粗分】: ${totalScore}/260分\n\n`;

    // 提醒：在严格的临床实践中，SRS 粗分需转换为 T 分数。
    // 在纯前端单参数展示中，采用您设定的粗分警示阈值。
    if (totalScore >= 100) { 
      conclusion = "重度异常";
      detailsStr += "临床建议：在社交互动、沟通及刻板行为方面存在显著且严重的困难，强烈建议立即寻求儿童精神专科医生进行系统的评估与干预指导。";
    } else if (totalScore >= 75) {
      conclusion = "轻/中度异常";
      detailsStr += "临床建议：存在较为明显的社交互动挑战或孤独症特征，建议在日常密切观察，并尽早咨询专业机构进行筛查确认。";
    } else {
      conclusion = "正常范围";
      detailsStr += "临床建议：目前的得分显示社交互动能力在同龄正常范围内，暂未发现明显的孤独症核心社交缺陷症状。";
    }

    return { 
      totalScore, 
      conclusion, 
      details: {
        description: detailsStr
      } 
    };
  }
};