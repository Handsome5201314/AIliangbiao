import type { ExecutableScaleDefinition, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：统一 A/B 选项格式
 * 在 MBTI 中，我们用 score 0 代表选项 A，score 1 代表选项 B
 */
const createMBTIOptions = (labelA: string, labelB: string) => [
  { label: `A. ${labelA}`, score: 0 },
  { label: `B. ${labelB}`, score: 1 }
];

// 完整 93 题 4D 结构化数据
const MBTI_QUESTIONS: ScaleQuestion[] = [
  // --- 第一部分：生活与社交场景偏好 (1-26题) ---
  { id: 1, text: '外出一整天', clinical_intent: 'J/P偏好', colloquial: '要是周末出去玩一整天，您是喜欢提前计划好几点去哪，还是想走就走？', fallback_examples: [], options: createMBTIOptions("计划好做什么时候做", "说去就去") },
  { id: 2, text: '认为自己是', clinical_intent: 'J/P偏好', colloquial: '您觉得自己平时是个随性的人，还是做事很有条理的人？', fallback_examples: [], options: createMBTIOptions("较为随兴所至", "较为有条理") },
  { id: 3, text: '当老师选教', clinical_intent: 'S/N偏好', colloquial: '假如您去当老师，您更喜欢教讲究客观事实的课，还是讲究抽象理论的课？', fallback_examples: [], options: createMBTIOptions("以事实为主", "涉及理论") },
  { id: 4, text: '社交状态', clinical_intent: 'E/I偏好', colloquial: '在陌生的环境里，您是很容易跟别人打成一片，还是比较喜欢安静地待着？', fallback_examples: [], options: createMBTIOptions("与人容易混熟", "比较沉静或矜持") },
  { id: 5, text: '合得来的人', clinical_intent: 'S/N偏好', colloquial: '您平时跟哪种人更聊得来？是想象力丰富的，还是脚踏实地比较现实的？', fallback_examples: [], options: createMBTIOptions("富于想象力", "现实的人") },
  { id: 6, text: '理智与情感', clinical_intent: 'T/F偏好', colloquial: '做决定的时候，您通常是跟着感觉走，还是更相信客观的理智分析？', fallback_examples: [], options: createMBTIOptions("情感支配理智", "理智主宰情感") },
  { id: 7, text: '处理事情', clinical_intent: 'J/P偏好', colloquial: '处理生活琐事时，您喜欢跟着兴致走，还是严格按计划来？', fallback_examples: [], options: createMBTIOptions("凭兴所至行事", "按照计划行事") },
  { id: 8, text: '被了解程度', clinical_intent: 'E/I偏好', colloquial: '您觉得别人是很容易看透您的心思，还是觉得您有点难捉摸？', fallback_examples: [], options: createMBTIOptions("容易让人了解", "难于让人了解") },
  { id: 9, text: '程序表', clinical_intent: 'J/P偏好', colloquial: '如果给您定一个严格的日程表，您是觉得很安心，还是觉得特别受拘束？', fallback_examples: [], options: createMBTIOptions("合心意", "感到束缚") },
  { id: 10, text: '特别任务', clinical_intent: 'J/P偏好', colloquial: '接到新任务时，您喜欢先做好周密的计划再动手，还是喜欢走一步看一步？', fallback_examples: [], options: createMBTIOptions("小心组织计划", "边做边找须做") },
  { id: 11, text: '大多数情况', clinical_intent: 'J/P偏好', colloquial: '大多数情况下，您是喜欢顺其自然，还是喜欢按部就班地做事？', fallback_examples: [], options: createMBTIOptions("顺其自然", "按程序表做事") },
  { id: 12, text: '别人评价', clinical_intent: 'E/I偏好', colloquial: '别人一般会说您是个注重隐私的人，还是个非常坦率开放的人？', fallback_examples: [], options: createMBTIOptions("重视自我隐私", "非常坦率开放") },
  { id: 13, text: '宁愿被认为', clinical_intent: 'S/N偏好', colloquial: '您更希望别人觉得您是个实事求是的人，还是个机灵、脑子转得快的人？', fallback_examples: [], options: createMBTIOptions("实事求是", "机灵的") },
  { id: 14, text: '人群中', clinical_intent: 'E/I偏好', colloquial: '在一大群人里，通常是您主动把大家介绍认识，还是等着别人来介绍您？', fallback_examples: [], options: createMBTIOptions("你介绍大家认识", "别人介绍你") },
  { id: 15, text: '交朋友', clinical_intent: 'S/N偏好', colloquial: '您交朋友，更喜欢经常有新主意的人，还是脚踏实地的人？', fallback_examples: [], options: createMBTIOptions("常提出新注意", "脚踏实地") },
  { id: 16, text: '感情与逻辑', clinical_intent: 'T/F偏好', colloquial: '您觉得在生活中，是感情更重要，还是逻辑更重要？', fallback_examples: [], options: createMBTIOptions("重视感情", "重视逻辑") },
  { id: 17, text: '计划发展', clinical_intent: 'J/P偏好', colloquial: '遇到事，您喜欢先看看事情怎么发展再做打算，还是早早就把计划定好？', fallback_examples: [], options: createMBTIOptions("坐观事情发展", "很早就作计划") },
  { id: 18, text: '时间分配', clinical_intent: 'E/I偏好', colloquial: '您更喜欢花时间一个人独处，还是和别人待在一起？', fallback_examples: [], options: createMBTIOptions("一个人独处", "和别人一起") },
  { id: 19, text: '群体反应', clinical_intent: 'E/I偏好', colloquial: '跟一大群人待在一起，是让您觉得精力充沛，还是让您觉得心力交瘁？', fallback_examples: [], options: createMBTIOptions("活力倍增", "心力憔悴") },
  { id: 20, text: '聚会安排', clinical_intent: 'J/P偏好', colloquial: '对于社交约会，您喜欢早早安排妥当，还是看当时的心情无拘无束地决定？', fallback_examples: [], options: createMBTIOptions("很早安排妥当", "无拘无束") },
  { id: 21, text: '旅程计划', clinical_intent: 'J/P偏好', colloquial: '去旅游的时候，您是每天看心情决定去哪，还是提前规划好每天的行程？', fallback_examples: [], options: createMBTIOptions("跟当天感觉行事", "事先知道做什么") },
  { id: 22, text: '社交聚会', clinical_intent: 'E/I偏好', colloquial: '在社交聚会上，您有时候会觉得郁闷无聊，还是常常乐在其中？', fallback_examples: [], options: createMBTIOptions("有时感到郁闷", "常常乐在其中") },
  { id: 23, text: '通常状态', clinical_intent: 'E/I偏好', colloquial: '您是很容易跟别人混熟，还是倾向于自己待在一个角落？', fallback_examples: [], options: createMBTIOptions("和别人容易混熟", "趋向自处一隅") },
  { id: 24, text: '吸引的人', clinical_intent: 'S/N偏好', colloquial: '哪种人更吸引您？是思维跳跃很聪明的人，还是实事求是有常识的人？', fallback_examples: [], options: createMBTIOptions("思想敏捷聪颖", "实事求是具常识") },
  { id: 25, text: '日常工作', clinical_intent: 'J/P偏好', colloquial: '在工作里，您是喜欢处理分秒必争的突发事件，还是喜欢预先计划好避免压力？', fallback_examples: [], options: createMBTIOptions("喜欢处理突发", "预先计划") },
  { id: 26, text: '别人认识你', clinical_intent: 'E/I偏好', colloquial: '您觉得别人要花很长时间才能真正了解您，还是很快就能摸透您？', fallback_examples: [], options: createMBTIOptions("花很长时间", "短时间") },

  // --- 第二部分：词语倾向选择 (27-58题) ---
  { id: 27, text: 'A注重隐私 B坦率开放', clinical_intent: '词语潜意识测试', colloquial: '如果用两个词来形容您的倾向，您觉得是“注重隐私”还是“坦率开放”？', fallback_examples: [], options: createMBTIOptions("注重隐私", "坦率开放") },
  { id: 28, text: 'A预先安排的 B无计划的', clinical_intent: '词语潜意识测试', colloquial: '您更喜欢“预先安排”还是“无计划”？', fallback_examples: [], options: createMBTIOptions("预先安排", "无计划") },
  { id: 29, text: 'A抽象 B具体', clinical_intent: '词语潜意识测试', colloquial: '您更偏向“抽象”还是“具体”？', fallback_examples: [], options: createMBTIOptions("抽象", "具体") },
  { id: 30, text: 'A温柔 B坚定', clinical_intent: '词语潜意识测试', colloquial: '您觉得自己的作风更“温柔”还是更“坚定”？', fallback_examples: [], options: createMBTIOptions("温柔", "坚定") },
  { id: 31, text: 'A思考 B感受', clinical_intent: '词语潜意识测试', colloquial: '遇到事情，您第一反应是去“思考”还是去“感受”？', fallback_examples: [], options: createMBTIOptions("思考", "感受") },
  { id: 32, text: 'A事实 B意念', clinical_intent: '词语潜意识测试', colloquial: '您更看重“事实”还是更看重“意念”？', fallback_examples: [], options: createMBTIOptions("事实", "意念") },
  { id: 33, text: 'A冲动 B决定', clinical_intent: '词语潜意识测试', colloquial: '您觉得自己做事的风格偏“冲动”还是偏果断的“决定”？', fallback_examples: [], options: createMBTIOptions("冲动", "决定") },
  { id: 34, text: 'A热衷 B文静', clinical_intent: '词语潜意识测试', colloquial: '在集体活动中，您是“热衷”参与，还是保持“文静”？', fallback_examples: [], options: createMBTIOptions("热衷", "文静") },
  { id: 35, text: 'A文静 B外向', clinical_intent: '词语潜意识测试', colloquial: '评价性格，您觉得自己是“文静”还是“外向”？', fallback_examples: [], options: createMBTIOptions("文静", "外向") },
  { id: 36, text: 'A有系统 B随意', clinical_intent: '词语潜意识测试', colloquial: '生活习惯上，您是“有系统”还是比较“随意”？', fallback_examples: [], options: createMBTIOptions("有系统", "随意") },
  { id: 37, text: 'A理论 B肯定', clinical_intent: '词语潜意识测试', colloquial: '您更倾向于“理论”探讨，还是寻求“肯定”的事实？', fallback_examples: [], options: createMBTIOptions("理论", "肯定") },
  { id: 38, text: 'A敏感 B公正', clinical_intent: '词语潜意识测试', colloquial: '处理人际关系，您是内心“敏感”还是尽量保持“公正”？', fallback_examples: [], options: createMBTIOptions("敏感", "公正") },
  { id: 39, text: 'A令人信服 B感人的', clinical_intent: '词语潜意识测试', colloquial: '您觉得一段话，是“令人信服”好，还是“感人”更好？', fallback_examples: [], options: createMBTIOptions("令人信服", "感人的") },
  { id: 40, text: 'A声明 B概念', clinical_intent: '词语潜意识测试', colloquial: '您更喜欢明确的“声明”，还是宽泛的“概念”？', fallback_examples: [], options: createMBTIOptions("声明", "概念") },
  { id: 41, text: 'A不受约束 B预先安排', clinical_intent: '词语潜意识测试', colloquial: '您喜欢“不受约束”还是“预先安排”好？', fallback_examples: [], options: createMBTIOptions("不受约束", "预先安排") },
  { id: 42, text: 'A矜持 B健谈', clinical_intent: '词语潜意识测试', colloquial: '在不太熟的人面前，您是“矜持”还是“健谈”？', fallback_examples: [], options: createMBTIOptions("矜持", "健谈") },
  { id: 43, text: 'A有条不紊 B不拘小节', clinical_intent: '词语潜意识测试', colloquial: '做事时，您是“有条不紊”还是“不拘小节”？', fallback_examples: [], options: createMBTIOptions("有条不紊", "不拘小节") },
  { id: 44, text: 'A意念 B实况', clinical_intent: '词语潜意识测试', colloquial: '您更关注未来的“意念”，还是当下的“实况”？', fallback_examples: [], options: createMBTIOptions("意念", "实况") },
  { id: 45, text: 'A同情怜悯 B远见', clinical_intent: '词语潜意识测试', colloquial: '您觉得领导者应该具备“同情怜悯”还是“远见”？', fallback_examples: [], options: createMBTIOptions("同情怜悯", "远见") },
  { id: 46, text: 'A利益 B祝福', clinical_intent: '词语潜意识测试', colloquial: '您觉得人与人之间，“利益”更现实，还是“祝福”更温暖？', fallback_examples: [], options: createMBTIOptions("利益", "祝福") },
  { id: 47, text: 'A务实的 B理论的', clinical_intent: '词语潜意识测试', colloquial: '您解决问题的方法是“务实的”还是“理论的”？', fallback_examples: [], options: createMBTIOptions("务实的", "理论的") },
  { id: 48, text: 'A朋友不多 B朋友众多', clinical_intent: '词语潜意识测试', colloquial: '您的交际圈，是知心“朋友不多”还是“朋友众多”？', fallback_examples: [], options: createMBTIOptions("朋友不多", "朋友众多") },
  { id: 49, text: 'A有系统 B即兴', clinical_intent: '词语潜意识测试', colloquial: '您安排工作是“有系统”的，还是“即兴”发挥的？', fallback_examples: [], options: createMBTIOptions("有系统", "即兴") },
  { id: 50, text: 'A富想象的 B以事论事', clinical_intent: '词语潜意识测试', colloquial: '您聊天时，是“富于想象”还是“以事论事”？', fallback_examples: [], options: createMBTIOptions("富想象的", "以事论事") },
  { id: 51, text: 'A亲切的 B客观的', clinical_intent: '词语潜意识测试', colloquial: '您给人的印象通常是“亲切的”还是“客观的”？', fallback_examples: [], options: createMBTIOptions("亲切的", "客观的") },
  { id: 52, text: 'A客观的 B热情的', clinical_intent: '词语潜意识测试', colloquial: '评价一件作品，您是“客观的”分析还是“热情的”赞美？', fallback_examples: [], options: createMBTIOptions("客观的", "热情的") },
  { id: 53, text: 'A建造 B发明', clinical_intent: '词语潜意识测试', colloquial: '您更喜欢按图纸“建造”还是无中生有地“发明”？', fallback_examples: [], options: createMBTIOptions("建造", "发明") },
  { id: 54, text: 'A文静 B爱合群', clinical_intent: '词语潜意识测试', colloquial: '休息时间，您是保持“文静”还是“爱合群”去凑热闹？', fallback_examples: [], options: createMBTIOptions("文静", "爱合群") },
  { id: 55, text: 'A理论 B事实', clinical_intent: '词语潜意识测试', colloquial: '遇到争议，您习惯引用“理论”还是列举“事实”？', fallback_examples: [], options: createMBTIOptions("理论", "事实") },
  { id: 56, text: 'A富同情 B合逻辑', clinical_intent: '词语潜意识测试', colloquial: '您的行事准则，是“富于同情”还是“合乎逻辑”？', fallback_examples: [], options: createMBTIOptions("富同情", "合逻辑") },
  { id: 57, text: 'A具分析力 B多愁善感', clinical_intent: '词语潜意识测试', colloquial: '您的内心，是“具分析力”的还是“多愁善感”的？', fallback_examples: [], options: createMBTIOptions("具分析力", "多愁善感") },
  { id: 58, text: 'A合情合理 B令人着迷', clinical_intent: '词语潜意识测试', colloquial: '您觉得一个故事应该是“合情合理”还是“令人着迷”？', fallback_examples: [], options: createMBTIOptions("合情合理", "令人着迷") },

  // --- 第三部分：行为倾向细节 (59-78题) ---
  { id: 59, text: '大项目', clinical_intent: 'J/P偏好', colloquial: '如果一周内要完成一个大项目，您是先列好计划，还是马上动手干？', fallback_examples: [], options: createMBTIOptions("把不同工作依次列出", "马上动工") },
  { id: 60, text: '社交场合中', clinical_intent: 'E/I偏好', colloquial: '在社交场合，您是觉得很难跟别人打开话匣子，还是跟大多数人都能从容长谈？', fallback_examples: [], options: createMBTIOptions("难打开话匣", "从容长谈") },
  { id: 61, text: '多数人做的事', clinical_intent: 'S/N偏好', colloquial: '大家都在做的事，您是按照一般的方法做，还是喜欢想个自己的新招？', fallback_examples: [], options: createMBTIOptions("按照一般认可方法", "构想自己的想法") },
  { id: 62, text: '新朋友', clinical_intent: 'E/I偏好', colloquial: '您刚认识的朋友能马上说出您的兴趣吗？还是必须深交之后才知道？', fallback_examples: [], options: createMBTIOptions("马上可以", "待真正了解后") },
  { id: 63, text: '喜欢的科目', clinical_intent: 'S/N偏好', colloquial: '上学时，您更喜欢讲究概念原理的课，还是讲事实数据的课？', fallback_examples: [], options: createMBTIOptions("讲授概念原则", "讲授事实数据") },
  { id: 64, text: '赞誉', clinical_intent: 'T/F偏好', colloquial: '如果有人夸您，您更希望别人夸您是个感性的人，还是理性的人？', fallback_examples: [], options: createMBTIOptions("一贯感性的人", "一贯理性的人") },
  { id: 65, text: '按照程序', clinical_intent: 'J/P偏好', colloquial: '您觉得按照程序表做事，是偶尔需要但不喜欢，还是觉得很有帮助且乐在其中？', fallback_examples: [], options: createMBTIOptions("需要但不喜欢", "有帮助且喜欢") },
  { id: 66, text: '一群人', clinical_intent: 'E/I偏好', colloquial: '和一群人在一起，您通常只跟熟悉的人私下聊，还是直接参与大伙的群聊？', fallback_examples: [], options: createMBTIOptions("跟熟悉的个别人聊", "参与大伙的谈话") },
  { id: 67, text: '聚会说话', clinical_intent: 'E/I偏好', colloquial: '在聚会上，您通常是说话最多的那个，还是更喜欢听别人说？', fallback_examples: [], options: createMBTIOptions("说话很多", "让别人多说话") },
  { id: 68, text: '周末清单', clinical_intent: 'J/P偏好', colloquial: '周末把要做的事列个清单，这个主意是合您心意，还是让您觉得提不起劲？', fallback_examples: [], options: createMBTIOptions("合意", "提不起劲") },
  { id: 69, text: '称许', clinical_intent: 'T/F偏好', colloquial: '您更喜欢别人夸您“能干”，还是夸您“富有同情心”？', fallback_examples: [], options: createMBTIOptions("能干的", "富有同情心") },
  { id: 70, text: '社交约会', clinical_intent: 'J/P偏好', colloquial: '您喜欢事先安排好社交约会，还是随兴所至地赴约？', fallback_examples: [], options: createMBTIOptions("事先安排", "随兴之所至") },
  { id: 71, text: '大型作业', clinical_intent: 'J/P偏好', colloquial: '面对大型工作，您喜欢边做边想，还是先把工作一步步拆分开？', fallback_examples: [], options: createMBTIOptions("边做边想", "首先把工作细分") },
  { id: 72, text: '滔滔不绝', clinical_intent: 'E/I偏好', colloquial: '您能滔滔不绝地聊天，是只限于跟有共同兴趣的人，还是跟任何人都可以？', fallback_examples: [], options: createMBTIOptions("只限共同兴趣", "几乎任何人") },
  { id: 73, text: '解决问题', clinical_intent: 'S/N偏好', colloquial: '遇到问题，您是倾向用证明有效的老办法，还是喜欢去分析解决没见过的新难题？', fallback_examples: [], options: createMBTIOptions("证明有效的方法", "针对尚未解决难题") },
  { id: 74, text: '阅读', clinical_intent: 'S/N偏好', colloquial: '为了乐趣看书时，您喜欢作者有奇特创新的表达，还是喜欢直话直说？', fallback_examples: [], options: createMBTIOptions("奇特创新", "直话直说") },
  { id: 75, text: '上司', clinical_intent: 'T/F偏好', colloquial: '您更愿意给天性善良但经常变卦的上司工作，还是言辞尖锐但合乎逻辑的上司工作？', fallback_examples: [], options: createMBTIOptions("天性淳良", "合乎逻辑") },
  { id: 76, text: '做事多数', clinical_intent: 'J/P偏好', colloquial: '您做事大多数是按当天的心情来，还是照提前拟好的程序表做？', fallback_examples: [], options: createMBTIOptions("按当天心情", "照拟好程序") },
  { id: 77, text: '交谈', clinical_intent: 'E/I偏好', colloquial: '您是可以和任何人从容交谈，还是只对特定的人或特定场合才能畅所欲言？', fallback_examples: [], options: createMBTIOptions("和任何人从容", "只对特定人") },
  { id: 78, text: '决定时', clinical_intent: 'T/F偏好', colloquial: '做决定时，您认为最重要的是根据事实衡量，还是考虑他人的感受？', fallback_examples: [], options: createMBTIOptions("据事实衡量", "考虑他人感受") },

  // --- 第四部分：深度词语倾向 (79-93题) ---
  { id: 79, text: 'A想象的 B真实的', clinical_intent: '词语潜意识测试', colloquial: '您更偏向于“想象的”还是“真实的”？', fallback_examples: [], options: createMBTIOptions("想象的", "真实的") },
  { id: 80, text: 'A仁慈慷慨的 B意志坚定的', clinical_intent: '词语潜意识测试', colloquial: '您觉得“仁慈慷慨的”品格更好，还是“意志坚定的”更好？', fallback_examples: [], options: createMBTIOptions("仁慈慷慨", "意志坚定") },
  { id: 81, text: 'A公正的 B有关怀心', clinical_intent: '词语潜意识测试', colloquial: '评判事情，您是“公正的”还是“有关怀心”的？', fallback_examples: [], options: createMBTIOptions("公正的", "有关怀心") },
  { id: 82, text: 'A制作 B设计', clinical_intent: '词语潜意识测试', colloquial: '您更享受“制作”的过程，还是“设计”的过程？', fallback_examples: [], options: createMBTIOptions("制作", "设计") },
  { id: 83, text: 'A可能性 B必然性', clinical_intent: '词语潜意识测试', colloquial: '您更看重事物未来的“可能性”，还是眼前的“必然性”？', fallback_examples: [], options: createMBTIOptions("可能性", "必然性") },
  { id: 84, text: 'A温柔 B力量', clinical_intent: '词语潜意识测试', colloquial: '您觉得什么更有价值，“温柔”还是“力量”？', fallback_examples: [], options: createMBTIOptions("温柔", "力量") },
  { id: 85, text: 'A实际 B多愁善感', clinical_intent: '词语潜意识测试', colloquial: '您觉得自己是个“实际”的人，还是有些“多愁善感”？', fallback_examples: [], options: createMBTIOptions("实际", "多愁善感") },
  { id: 86, text: 'A制造 B创造', clinical_intent: '词语潜意识测试', colloquial: '对于产出，您偏好流水的“制造”还是灵光的“创造”？', fallback_examples: [], options: createMBTIOptions("制造", "创造") },
  { id: 87, text: 'A新颖的 B已知的', clinical_intent: '词语潜意识测试', colloquial: '您更容易被“新颖的”事物吸引，还是更喜欢“已知的”事物？', fallback_examples: [], options: createMBTIOptions("新颖的", "已知的") },
  { id: 88, text: 'A同情 B分析', clinical_intent: '词语潜意识测试', colloquial: '听到悲惨的故事，您的第一反应是“同情”还是客观“分析”？', fallback_examples: [], options: createMBTIOptions("同情", "分析") },
  { id: 89, text: 'A坚持己见 B温柔有爱心', clinical_intent: '词语潜意识测试', colloquial: '发生冲突时，您是“坚持己见”，还是“温柔有爱心”地让步？', fallback_examples: [], options: createMBTIOptions("坚持己见", "温柔有爱心") },
  { id: 90, text: 'A具体的 B抽象的', clinical_intent: '词语潜意识测试', colloquial: '您的思维更倾向于“具体的”细节，还是“抽象的”大局？', fallback_examples: [], options: createMBTIOptions("具体的", "抽象的") },
  { id: 91, text: 'A全心投入 B有决心的', clinical_intent: '词语潜意识测试', colloquial: '做一件事，您是感性地“全心投入”，还是理智且“有决心的”？', fallback_examples: [], options: createMBTIOptions("全心投入", "有决心的") },
  { id: 92, text: 'A能干 B仁慈', clinical_intent: '词语潜意识测试', colloquial: '您希望别人评价您“能干”还是“仁慈”？', fallback_examples: [], options: createMBTIOptions("能干", "仁慈") },
  { id: 93, text: 'A实际 B创新', clinical_intent: '词语潜意识测试', colloquial: '在工作中，您觉得“实际”更重要，还是“创新”更重要？', fallback_examples: [], options: createMBTIOptions("实际", "创新") }
];

/**
 * 核心引擎：MBTI 多维对冲算分键值矩阵
 * [选项A代表的维度, 选项B代表的维度]
 */
const SCORING_KEY: Record<number, [string, string]> = {
  1: ['J','P'],  2: ['P','J'],  3: ['S','N'],  4: ['E','I'],  5: ['N','S'],  6: ['F','T'],  7: ['P','J'],  8: ['E','I'],  9: ['J','P'], 10: ['J','P'],
 11: ['P','J'], 12: ['I','E'], 13: ['S','N'], 14: ['E','I'], 15: ['N','S'], 16: ['F','T'], 17: ['P','J'], 18: ['I','E'], 19: ['E','I'], 20: ['J','P'],
 21: ['P','J'], 22: ['I','E'], 23: ['E','I'], 24: ['N','S'], 25: ['P','J'], 26: ['I','E'], 27: ['I','E'], 28: ['J','P'], 29: ['N','S'], 30: ['F','T'],
 31: ['T','F'], 32: ['S','N'], 33: ['P','J'], 34: ['E','I'], 35: ['I','E'], 36: ['J','P'], 37: ['N','S'], 38: ['F','T'], 39: ['T','F'], 40: ['S','N'],
 41: ['P','J'], 42: ['I','E'], 43: ['J','P'], 44: ['N','S'], 45: ['F','T'], 46: ['T','F'], 47: ['S','N'], 48: ['I','E'], 49: ['J','P'], 50: ['N','S'],
 51: ['F','T'], 52: ['T','F'], 53: ['S','N'], 54: ['I','E'], 55: ['N','S'], 56: ['F','T'], 57: ['T','F'], 58: ['T','F'], 59: ['J','P'], 60: ['I','E'],
 61: ['S','N'], 62: ['E','I'], 63: ['N','S'], 64: ['F','T'], 65: ['P','J'], 66: ['I','E'], 67: ['E','I'], 68: ['J','P'], 69: ['T','F'], 70: ['J','P'],
 71: ['P','J'], 72: ['I','E'], 73: ['S','N'], 74: ['N','S'], 75: ['F','T'], 76: ['P','J'], 77: ['E','I'], 78: ['T','F'], 79: ['N','S'], 80: ['F','T'],
 81: ['T','F'], 82: ['S','N'], 83: ['N','S'], 84: ['F','T'], 85: ['T','F'], 86: ['S','N'], 87: ['N','S'], 88: ['F','T'], 89: ['T','F'], 90: ['S','N'],
 91: ['F','T'], 92: ['T','F'], 93: ['S','N']
};

/**
 * 16型人格解析字典
 */
const MBTI_DESCRIPTIONS: Record<string, string> = {
  "INTJ": "【建筑师/专家型】具强大动力与本意来达成目的与创意，对专业水准及绩效要求高。宏大愿景，冷峻、深邃、独立。",
  "INTP": "【逻辑学家/学者型】安静、自持、弹性及具适应力。特别喜爱追求理论与科学事理，习于以逻辑解决问题。",
  "ENTJ": "【指挥官/统帅型】坦诚、具决策力的活动领导者。长于发展与实施广泛的系统以解决组织的问题。",
  "ENTP": "【辩论家/发明家】反应快、聪明、长于多样事务。对解决新及挑战性的问题富有策略，常转移至新兴趣。",
  "INFJ": "【提倡者/咨询师】坚忍、创意及必须达成的意图而能成功。默默强力的、诚挚的关切他人，坚信其价值观。",
  "INFP": "【调停者/治愈者】安静观察者，具理想性与对其价值观及重要之人具忠诚心。具好奇心且很快能看出机会所在。",
  "ENFJ": "【主人公/教育家】热忱、易感应及负责任的。对别人所想或希求会表达真正关切且切实用心去处理，具领导风格。",
  "ENFP": "【竞选者/奋斗者】充满热忱、活力充沛、聪明的。对难题很快就有对策并能对有困难的人施予援手，即兴执行者。",
  "ISTJ": "【物流师/检查员】严肃、安静、藉由集中心志与全力投入获致成功。行事务实、有序、实际、逻辑及可信赖。",
  "ISFJ": "【守卫者/保护者】安静、和善、负责任且有良心。安定性高，常居团体之安定力量。对细节有耐心，忠诚。",
  "ESTJ": "【总经理/管家型】务实、真实、事实倾向。喜好组织与管理活动且专注以最有效率方式行事以达致成效。",
  "ESFJ": "【执政官/主人翁】诚挚、爱说话、合作性高、受欢迎。重和谐且长于创造和谐，常作对他人有益的事务。",
  "ISTP": "【鉴赏家/手艺人】冷静旁观者，安静、预留余地、弹性。擅长于掌握问题核心及找出解决方式，重效能。",
  "ISFP": "【探险家/艺术家】羞怯的、安宁和善地、敏感的、亲切的。喜于避开争论，不对他人强加已见或价值观。",
  "ESTP": "【企业家/实践者】擅长现场实时解决问题。倾向于喜好技术事务及运动，具适应性、容忍度、务实性。",
  "ESFP": "【表演者】外向、和善、接受性。最擅长于人际相处能力及具备完备常识，很有弹性能立即适应他人与环境。"
};

export const MBTI_Scale: ExecutableScaleDefinition = {
  id: "MBTI",
  version: "1.0",
  source: "builtin",
  category: "Personality",
  tags: ["人格", "职业性格", "MBTI"],
  estimatedMinutes: 18,
  interactionMode: "full_voice",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: false,
  title: {
    zh: "MBTI职业性格测试 (完整版)",
    en: "MBTI Personality Assessment"
  },
  description: {
    zh: "迈尔斯-布里格斯类型指标，多维度探索个人的精力来源、信息获取、决策方式以及生活态度。极具社交与自我发掘价值。",
    en: "A full Myers-Briggs personality assessment for exploring energy source, perception, decision making, and lifestyle preference."
  },
  questions: MBTI_QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    // 补齐答案防越界 (默认补0，即偏向左侧属性)
    const safeAnswers = answers.length === 93 ? answers : [...answers, ...Array(93 - answers.length).fill(0)];

    // 1. 初始化八大维度的统计容器
    const tallies: Record<string, number> = {
      'E': 0, 'I': 0,
      'S': 0, 'N': 0,
      'T': 0, 'F': 0,
      'J': 0, 'P': 0
    };

    // 2. 核心对抗计算引擎
    safeAnswers.forEach((score, index) => {
      const questionId = index + 1;
      const keyMap = SCORING_KEY[questionId];
      if (keyMap) {
        // score 为 0 对应数组第一个字母，score 为 1 对应第二个字母
        const selectedTrait = keyMap[score]; 
        tallies[selectedTrait]++;
      }
    });

    // 3. 处理对抗维度的胜出者 (平局则按照量表附录标准偏好处理)
    const finalE = tallies['E'] > tallies['I'] ? 'E' : 'I'; 
    const finalS = tallies['S'] > tallies['N'] ? 'S' : 'N'; 
    const finalT = tallies['T'] > tallies['F'] ? 'T' : 'F'; 
    const finalJ = tallies['J'] > tallies['P'] ? 'J' : 'P'; 

    // 4. 拼接最终 16 型人格代码
    const personalityType = `${finalE}${finalS}${finalT}${finalJ}`;
    const desc = MBTI_DESCRIPTIONS[personalityType] || "独特的性格类型组合。";
    const preferenceStrength =
      Math.max(tallies['E'], tallies['I']) +
      Math.max(tallies['S'], tallies['N']) +
      Math.max(tallies['T'], tallies['F']) +
      Math.max(tallies['J'], tallies['P']);

    let detailsStr = `【测试结果】：您的性格倾向为 ${personalityType}\n\n`;
    detailsStr += `【维度倾向分布】：\n外向(E): ${tallies['E']} | 内向(I): ${tallies['I']}\n感觉(S): ${tallies['S']} | 直觉(N): ${tallies['N']}\n思考(T): ${tallies['T']} | 情感(F): ${tallies['F']}\n判断(J): ${tallies['J']} | 感知(P): ${tallies['P']}\n\n`;
    detailsStr += `【结果说明】：MBTI 官方结果以人格类型代码为主，下方“倾向强度”仅表示四个胜出维度的累计票数，不是百分制分数。\n\n`;
    detailsStr += `【性格深度解析】：\n${desc}`;

    return { 
      totalScore: preferenceStrength,
      conclusion: personalityType, 
      details: {
        description: detailsStr,
        scoreLabel: "人格类型",
        scoreDisplay: personalityType,
        totalScoreLabel: "倾向强度",
        totalScoreHint: "该数值为四个维度胜出侧累计票数，不是百分制分数。",
        dimensions: {
          energy: { label: "外向/内向", E: tallies['E'], I: tallies['I'], winner: finalE },
          perception: { label: "感觉/直觉", S: tallies['S'], N: tallies['N'], winner: finalS },
          judgment: { label: "思考/情感", T: tallies['T'], F: tallies['F'], winner: finalT },
          lifestyle: { label: "判断/感知", J: tallies['J'], P: tallies['P'], winner: finalJ }
        }
      } 
    };
  }
};
