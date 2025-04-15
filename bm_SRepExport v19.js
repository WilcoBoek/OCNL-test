function SRepExoprt() {
	/* == SearchReport Export v0.19 == */
	const projID = document.title.substr(document.title.search(": ")+2);
	const projID1 = (!isNaN(projID)) ? ('EP' + projID) : (projID);
	
	/* == 1: Open project-json with basic info */
	const projURL = "https://search.epo.org/search-service-layer/master/v4/api/transit/project/" + projID1;
	fetch(projURL, {headers: {'Accept': 'application/json'}, method: "GET"})
	.then(e=>e.json())
	.then(e=>getDrawers(e))
	.catch((error) => { /* fix to solve cors problem */
		var win1 = window.open(projURL);
		win1.onload = function () {
			win1.close();
			fetch(projURL, {headers: {'Accept': 'application/json'}, method: "GET"})
			.then(e=>e.json())
			.then(e=>getDrawers(e))
		};
    });
	
	async function getDrawers(e) {
		/* === 2: Open project-json with drawers */
		const drawersURL = e._links.drawers.href;
		fetch(drawersURL, {headers: {'Accept': 'application/json'}, method: "GET"})
		.then(e=>e.json())
		.then(e=>selectDrawer(e))
	};
		
	async function selectDrawer(e) {
		/* === 3: Select and open project-json with drawers */
		const id = [];
		const name = [];
		const drawerURL = [];
		var j=0; 
		for (let i=0; i< e._embedded.drawers.length; i++) {
			if (!isNaN(e._embedded.drawers[i].id)) {
				id[j] = e._embedded.drawers[i].id;
				name[j] = e._embedded.drawers[i].name;
				drawerURL[j] = e._embedded.drawers[i]._links.self.href;
				j++;
			}
		}
		
		var drawerViewList = document.querySelectorAll("[role='button']");
		for (let i=0; i<drawerViewList.length; i++) {
			if (drawerViewList[i].innerText == "W\nDrawers") {
				drawerViewList[i].click(); /* show drawer-view */
				await sleep(1000);
			}
		}

		var drawerList = document.querySelectorAll("[data-testid='custom-drawer-box']");
		var lStr = []; 
		var selStr = [];
		const lName = [];
		const lNr = [];
		const lId = [];
		const ldrawerURL = [];
		for (let i=0; i<drawerList.length; i++) {
			lStr = i+1 + ": " + drawerList[i].outerText.split('\n').slice(-2).join("  ");
			selStr += lStr + "\n";
			lNr[i] = parseInt(lStr.split(" ")[0]);
			for (let j=0; j<name.length; j++) {
				if (lStr.includes(name[j])) {
					lId[i] = id[j];
					lName[i] = name[j];
					ldrawerURL[i] = drawerURL[j];
				}
			}
		}  

		var select = drawerList.length;
		if (drawerList.length>1) {
			if (lName.indexOf("SRep")>=0) {
				select = lName.indexOf("SRep")+1;
			} else {
				select = prompt("Kies een nummer van een drawer om te exporteren:\n\n" + selStr, "");
			}
		}
		if (select==null || select < 1 || select > drawerList.length) {return;}
	  
		/* === 2b: Stel volgorde van documenten in geselecteerd Drawer vast */
		/* Selecteer de Drawer die geëxporteert moet worden */
		var sel = lNr.indexOf(parseInt(select));
		var selectedDrawer = drawerList[sel]; 
		selectedDrawer.click();
		await sleep(1000);
		document.getElementById("drawer-dropdown").click();
		await sleep(500);
		/* Lees de inhoud van het dropdownmenu/de Drawer */
		const order = document.getElementsByClassName("OptionLabel__optionNumber");
		var tmpOrder = Array.prototype.slice.call(order);
		var arrOrder = Array.from(tmpOrder, element => element.innerHTML);
		selectedDrawer.click();  /* close again */
  
		/* === 3: Open Drawer-json with documents */
		const drawerID = lId[sel];
		const drawerName = lName[sel];
		const drawrURL = ldrawerURL[sel];
		const responseDraw = await fetch(drawrURL, {headers: {'Accept': 'application/json'}, method: "GET"});
		const objDraw = await responseDraw.json();
		if (!("_embedded" in objDraw)) {
			alert("Drawer \""+ drawerName + "\" is leeg!");
			return;
		}
		const numDocs = objDraw._embedded.documents.length;

		/* === 4: For each document: open Biblio and exportert to xml-file for BPP-SearchReport */
		let result = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>" + "\n";
		result += "<citationsfile>" + "\n";
		result += "\t<project>" + projID + "</project>\n";
		result += "\t<drawer>" + drawerName + "</drawer>\n";
		const months = new Array("januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december");
		var intermediate = [];
		var patOrder = [];
		var ind = [];
		for (let i=0; i<numDocs ; i++) {
			/* loop over all documents in drawer */
			const docIDhref = objDraw._embedded.documents[i]._links.self.href; /* docID */
			const drawerPN = objDraw._embedded.documents[i].pn_docdb;
			const famID = objDraw._embedded.documents[i].family_id;
			const drawerPN_isNPL = (famID.slice(0,3) == "NPL");
			var drawerPN_cc = [];
			var drawerPN_nr = [];
			var drawerPN_kc = [];
			var drawerPN_pd = [];
			var drawerPN_pd1 = [];
			var drawerPN_pa = [];
			var drawerPN_ti = [];
			patOrder.push(drawerPN);
					
			const drawerPN_espace = "https://worldwide.espacenet.com/patent/search/family/" + famID + "/publication/" + drawerPN + "?q=pn%3D" +  drawerPN;

			/* Open Bilblio-json with family members + publications */
			const responseDoc = await fetch(docIDhref.substr(23) + '/biblio/', {headers: {'Accept': 'application/json'}, method: "GET"});
			const objDoc = await responseDoc.json();
			const famMembers = [];
			var k = 0;
			
			if (!drawerPN_isNPL) {
				/* in case of PL */
				drawerPN_cc = drawerPN.slice(0,2);
				drawerPN_nr = drawerPN.match(/[A-Z]*[0-9]*/g)[0];
				drawerPN_kc = drawerPN.slice(drawerPN_nr.length);
				var drawerPN_cpc = [];
				var drawerPN_ipc = [];
				var drawerPN_iw = [];

				for (const iDoc in objDoc){ 
					/* loop over all applications in family */
					const objDocPN = objDoc[iDoc];
					for (const jDoc in objDocPN.pn_docdb){ 
						/* loop over all publications in application */		
						const pub_pn = objDocPN.pn_docdb[jDoc][0];
						const pub_pn_cc = pub_pn.slice(0,2);
						const pub_pn_nr = pub_pn.match(/[A-Z]*[0-9]*/g)[0];
						const pub_pn_kc = pub_pn.slice(pub_pn_nr.length);

						var pub_pd = [];
						for (const j1 in objDocPN.pd){
							if (j1.search(pub_pn_kc)>=0) {
								pub_pd = objDocPN.pd[j1][0];
								drawerPN_pd = pub_pd.replace(/-/g, "");
								/* NL PD: formatted date */
								drawerPN_pd1 = pub_pd.substr(8,2).replace(/^0+/, '') + " " + months[parseInt(pub_pd.substr(5,2))-1] + " " + pub_pd.substr(0,4);
								drawerPN_pd1 = drawerPN_pd1.trim();
							}
						}
						
						if (pub_pn == drawerPN) {
							/* PA: applicant or inventors */
							for (const j1 in objDocPN.pa_patents){
								if (j1.search(pub_pn_kc)>=0) {
									drawerPN_pa = objDocPN.pa_patents[j1][0].toUpperCase(); }} /* only first applicant*/
							if (drawerPN_pa == "") {
								for (const j1 in objDocPN.pa_unstd_patents){
									if (j1.search(pub_pn_kc)>=0) {
										drawerPN_pa = objDocPN.pa_unstd_patents[j1][0].toUpperCase(); }}} /* only first applicant*/
							if (drawerPN_pa == "") {
								for (const j1 in objDocPN.in_patents){
									if (j1.search(pub_pn_kc)>=0) {
										drawerPN_pa = objDocPN.in_patents[j1][0].toUpperCase();
										if (objDocPN.in_patents[j1].length>1) {
											drawerPN_pa += " et al."} }}}
							if (drawerPN_pa == "") {
								for (const j1 in objDocPN.in_unstd_patents){
									if (j1.search(pub_pn_kc)>=0) {
										drawerPN_pa = objDocPN.in_patents[j1][0].toUpperCase();
										if (objDocPN.in_unstd_patents[j1].length>1) {
											drawerPN_pa += " et al."} }}}
							if (drawerPN_pa == "") {
								for(const jj1 in objDocPN.pa_patents){
									if(objDocPN.pa_patents[jj1][0]!="" && drawerPN_pa == ""){
										drawerPN_pa = objDocPN.pa_patents[jj1][0].toUpperCase(); } /* if no applicant is found for X-pub, select first available*/
									else if(objDocPN.pa_unstd_patents[jj1][0]!="" && objDocPN.pa_unstd_patents[jj1][0]!=null  && drawerPN_pa == ""){
										drawerPN_pa = objDocPN.pa_unstd_patents[jj1][0].toUpperCase(); }
									else if(objDocPN.in_patents[jj1][0]!="" && objDocPN.in_patents[jj1][0]!=null  && drawerPN_pa == ""){
										drawerPN_pa = objDocPN.in_patents[jj1][0].toUpperCase(); }
									else if(objDocPN.in_unstd_patents[jj1][0]!="" && objDocPN.in_unstd_patents[jj1][0]!=null  && drawerPN_pa == ""){
										drawerPN_pa = objDocPN.in_unstd_patents[jj1][0].toUpperCase(); }
									else{
										drawerPN_pa = " - "; }}}
							
							/* TI: titel */
							for (const j2 in objDocPN.ti_en){
								if (j2.search(pub_pn_kc)>=0) {
									drawerPN_ti = objDocPN.ti_en[j2][0]; }}
							if (drawerPN_ti == "") {
								for (const jj2 in objDocPN.ti_en){
									if (drawerPN_ti == "" && objDocPN.ti_en[jj2][0]!=null && objDocPN.ti_en[jj2][0]!="") {
										drawerPN_ti = objDocPN.ti_en[jj2][0]; }}}
							if (drawerPN_ti == "") {
								for (const jj2 in objDocPN.wpi_ti_en){
									if (drawerPN_ti == "" && objDocPN.wpi_ti_en[jj2][0]!=null && objDocPN.wpi_ti_en[jj2][0]!="") {
										drawerPN_ti = objDocPN.wpi_ti_en[jj2][0]; }}}
							if (drawerPN_ti == "") {
								for (const jj2 in objDocPN.ti_de){
									if (drawerPN_ti == "" && objDocPN.ti_de[jj2][0]!=null && objDocPN.ti_de[jj2][0]!="") {
										drawerPN_ti = objDocPN.ti_de[jj2][0]; }}}
							if (drawerPN_ti == "") {
								for (const jj2 in objDocPN.ti_fr){
									if (drawerPN_ti == "" && objDocPN.ti_fr[jj2][0]!=null && objDocPN.ti_fr[jj2][0]!="") {
										drawerPN_ti = objDocPN.ti_fr[jj2][0]; }}}
							
							/* CPCs: CCI (cci_cpci) +  CI (ci_cpci) */
							for (const j1 in objDocPN.cci_cpci){
								if (j1.search(pub_pn_kc)>=0) {drawerPN_cpc = objDocPN.cci_cpci[j1];}} 
							for (const j1 in objDocPN.ci_cpci){
								if (j1.search(pub_pn_kc)>=0) {drawerPN_cpc.push(objDocPN.ci_cpci[j1]);}} 
							drawerPN_cpc = uniqueArray(drawerPN_cpc); 
							
							/* IPCs: ICAI (ipc_icai) + IC (ipc_ic) */
							for (const j1 in objDocPN.ipc_icai){
								if (j1.search(pub_pn_kc)>=0) {drawerPN_ipc = objDocPN.ipc_icai[j1]; }} 
							for (const j1 in objDocPN.ipc_ic){
								if (j1.search(pub_pn_kc)>=0) {drawerPN_ipc.push(objDocPN.ipc_ic[j1]); }} 
							drawerPN_ipc = uniqueArray(drawerPN_ipc);
							
							/* IW: index words*/
							for (const j1 in objDocPN.wpi_iw){
								if (j1.search(pub_pn_kc)>=0) {
									drawerPN_iw = objDocPN.wpi_iw[j1].join("; "); }} 
						}
						famMembers[k] = pub_pn_nr + " " + pub_pn_kc + " " + pub_pd.replace(/-/g, "");
						k++;
					}
				}
					
				/* NL PN: formatted PN number */
				var drawerPN_no = drawerPN_nr.slice(2);
				var drawerPN_ok = drawerPN_no;
				const year = drawerPN_pd.substr(0,4);
				switch (drawerPN_cc) {
					case "US": 
						if (drawerPN_no.slice(2,4)==year && drawerPN_no.length==11) {
							drawerPN_ok = drawerPN_no.slice(0,2) + "/" + drawerPN_no.slice(4); }
						if (drawerPN_no.slice(0,4)==year && drawerPN_no.length==10) {
							drawerPN_ok = drawerPN_no.slice(0,4) + "/0" + drawerPN_no.slice(4); }
						break;
					case "WO":
						if (drawerPN_no.slice(0,4)>=2004 && drawerPN_no.slice(0,4)<2100) {
							drawerPN_ok = drawerPN_no.slice(0,4) + "/" + drawerPN_no.slice(4); } 
						else {
							drawerPN_ok = drawerPN_no.slice(0, 2) + "/" + drawerPN_no.slice(2);	}
						break;
					case "JP":
						if (drawerPN_no[0]=="S" || drawerPN_no[0]=="H") {
							drawerPN_ok = drawerPN_no.slice(0, 3) + "-" + drawerPN_no.slice(3); }
						else {
							if (year>=2000 && drawerPN_no.substr(0,4)==year) {
								drawerPN_ok = drawerPN_no.slice(0, 4) + "-" + drawerPN_no.slice(4); }
							if ((year>=1990 && year <= 1997) || (year==1989 && drawerPN_no[0]=="1")) {
							  drawerPN_ok = drawerPN_no.slice(0, 1) + "-" + drawerPN_no.slice(1); }
							if ((year>1997 && year<=1999 && drawerPN_no[0]=="1") || (year==1989 && drawerPN_no[0]=="6") || (year>=1936 && year<1989)) {
							  drawerPN_ok = drawerPN_no.slice(0, 2) + "-" + drawerPN_no.slice(2); }	}
						break;
					case "KR":
						if (drawerPN_no.slice(0,4)==year) {
							drawerPN_ok = drawerPN_no.slice(0, 4) + "/" + drawerPN_no.slice(4);	}
						break;
				}

				intermediate.push("\t<document>" + "\n");
				intermediate[i] += "\t\t<field name=\"PN\">" + drawerPN_nr + " " + drawerPN_kc + " " + drawerPN_pd + "</field>\n";
				intermediate[i] += "\t\t<field name=\"NL PN\">" + drawerPN_cc + ' ' + drawerPN_ok + ' ' + drawerPN_kc + "</field>\n";
				intermediate[i] += "\t\t<field name=\"NL PD\">" + drawerPN_pd1 + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"NL PA\">" + txt2Xml(drawerPN_pa) + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"TI\">" + txt2Xml(drawerPN_ti) + "</field>\n"; 
				intermediate[i] += "\t\t<espacelink>" + drawerPN_espace + "</espacelink>\n"; 
				intermediate[i] += "\t\t<field name=\"CPC\">" + drawerPN_cpc.join("; ") + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"IPC\">" + drawerPN_ipc.join("; ") + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"IW\">" + drawerPN_iw + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"FAMN\">" + famID + "</field>\n";
				intermediate[i] += "\t\t<famn>\n";
				for (let k=0; k<famMembers.length; k++){
							intermediate[i] += "\t\t\t<field name=\"PN\">" + famMembers[k] + "</field>\n";
				}
				intermediate[i] += "\t\t</famn>\n";
				intermediate[i] += "\t</document>" + "\n";  
			} else { 
				/* in case of NPL */
				var drawerPN_mg = [];
				var drawerPN_vl = [];
				var drawerPN_is = [];
				var drawerPN_pg = [];
				for (const iDoc in objDoc){ 
					/* loop over all publications in family */
					const objDocPN = objDoc[iDoc];
					if (drawerPN == objDocPN.accessnum["*"][0]) {
						drawerPN_nr = objDocPN.accessnum["*"][0];
						drawerPN_pd = objDocPN.pd["*"][0];
						drawerPN_pa = objDocPN.author["*"][0].toUpperCase();
						if (objDocPN.author["*"].length>1) {drawerPN_pa += " et al."};
						drawerPN_pd1 = drawerPN_pd.substr(8,2).replace(/^0+/, '') + " " + months[parseInt(drawerPN_pd.substr(5,2))-1] + " " + drawerPN_pd.substr(0,4);
						drawerPN_pd1 = drawerPN_pd1.trim();
						drawerPN_ti = objDocPN.ti_en["*"][0];
						drawerPN_mg = objDocPN.pubdata["*"][0];
						try{
							drawerPN_vl = objDocPN.vol["*"][0];
						}
						catch(TypeError){
							drawerPN_vl = "";
						}
						try{
							drawerPN_is = objDocPN.issue["*"][0];
						}
						catch(TypeError){
							drawerPN_is = "";
						}
						drawerPN_pg = objDocPN.pages["*"][0];
						if (drawerPN_ti == "") {drawerPN_ti = objDocPN.ti_de["*"][0];}
					}
				}

				intermediate.push("\t<document>" + "\n");
				intermediate[i] += "\t\t<field name=\"PN\">" + drawerPN_nr + " " + drawerPN_pd + "</field>\n";
				intermediate[i] += "\t\t<field name=\"NPL\">" + "NPL" + "</field>\n";
				intermediate[i] += "\t\t<field name=\"NL PN\">" + drawerPN_nr + "</field>\n";
				intermediate[i] += "\t\t<field name=\"NL PD\">" + drawerPN_pd1 + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"NL PA\">" + txt2Xml(drawerPN_pa) + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"TI\">" + txt2Xml(drawerPN_ti) + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"MG\">" + txt2Xml(drawerPN_mg) + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"VL\">" + txt2Xml("vol. " + drawerPN_vl) + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"IS\">" + txt2Xml("nr. " + drawerPN_is) + "</field>\n"; 
				intermediate[i] += "\t\t<field name=\"PG\">" + txt2Xml("blz. " + drawerPN_pg) + "</field>\n"; 
				intermediate[i] += "\t</document>" + "\n";
			}
			ind[i] = arrOrder.indexOf(drawerPN);
		}
		/* if some ind are not found in drawer, then add to the end */
		for (let i=0; i<numDocs ; i++) {
			if (ind[i]==-1) { 
				ind[i] = numDocs+i;
			}
		}
		var tmpIntermed = [];
		for (let i=0; i<ind.length; i++) {
			tmpIntermed[ind[i]] = intermediate[i];
		} 
		result += tmpIntermed.join("");
		result += "</citationsfile>";
		
		const file = new Blob([result], { type: 'text/plain' });
		const lk = document.createElement("a");
		const expFileName = "SearchDocs_"  + projID + ".xml";
		lk.href = URL.createObjectURL(file);
		lk.download = expFileName;
		lk.click();
		URL.revokeObjectURL(lk.href);  
	}
	
	function uniqueArray(a) {
		if (a==""){return [];}
		let b = a.flat(Infinity).join("; ").replace(/\s\([^)]*\)/g, "").split("; ");
		let c = Array.from(new Set(b)); 
		return c;
	}
	
		
	function txt2Xml(strIn){
		if (strIn.length === 0) return strIn;
		var strOut = strIn;		
		strOut = strOut.replaceAll("<","&"+"lt;");
		strOut = strOut.replaceAll(">","&"+"gt;");
		strOut = strOut.replaceAll("&","&"+"amp;");
		return strOut
	}

	function sleep(ms){
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
