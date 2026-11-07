import Academy from "@/components/Academy";
import AdvancedAcademy from "@/components/AdvancedAcademy";
import RangeLab from "@/components/RangeLab";
import DecisionMathLab from "@/components/DecisionMathLab";
import BluffDecisionLab from "@/components/BluffDecisionLab";
import StudyPlanner from "@/components/StudyPlanner";
import PokerDictionary from "@/components/PokerDictionary";
import TransferPractice from "@/components/TransferPractice";
import AcademyChambers from "@/components/AcademyChambers";
import WorkspaceLinks from "@/components/WorkspaceLinks";

export default function Page(){
 return <main className="academy-new-page academy-chambers-page">
  <WorkspaceLinks current="Academy"/>
  <AcademyChambers
   foundations={<section id="core-lessons" className="academy-legacy-wrap"><Academy/></section>}
   dictionary={<section id="dictionary"><PokerDictionary/></section>}
   preflop={<section id="range-lab"><RangeLab/></section>}
   mathematics={<><section id="math-lab"><DecisionMathLab/></section><section id="bluff-lab"><BluffDecisionLab/></section></>}
   decisions={<section id="transfer-training"><TransferPractice/></section>}
   strategy={<section id="advanced-school"><AdvancedAcademy/></section>}
   reflection={<section id="study-plan"><StudyPlanner/></section>}
  />
 </main>;
}