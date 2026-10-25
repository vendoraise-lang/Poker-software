import Academy from "@/components/Academy";
import AdvancedAcademy from "@/components/AdvancedAcademy";
import RangeLab from "@/components/RangeLab";
import WorkspaceLinks from "@/components/WorkspaceLinks";

export default function Page(){
 return <main className="academy-new-page">
  <header className="academy-new-hero"><WorkspaceLinks current="Academy"/><span>POKERLAB · THE STRATEGY SCHOOL</span><h1>Learn poker by making decisions.</h1><p>Start with the interactive range trainer, then practice strategy and review your mistakes. Every lesson here uses play chips only.</p><nav aria-label="Academy sections"><a href="#range-lab">Range lab</a><a href="#advanced-school">Strategy school</a><a href="#core-lessons">Foundation lessons</a></nav></header>
  <section id="range-lab"><RangeLab/></section>
  <section id="advanced-school"><AdvancedAcademy/></section>
  <details id="core-lessons" className="academy-legacy-wrap"><summary>Foundation curriculum · 7 modules, lessons and assessments</summary><Academy/></details>
 </main>;
}