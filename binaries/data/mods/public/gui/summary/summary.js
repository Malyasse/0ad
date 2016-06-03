const g_MaxHeadingTitle= 8;

// const for filtering long collective headings
const g_LongHeadingWidth = 250;

const g_PlayerBoxYSize = 30;
const g_PlayerBoxGap = 2;
const g_PlayerBoxAlpha = " 32";
const g_PlayerColorBoxAlpha = " 255";
const g_TeamsBoxYStart = 65;

// Colors used for units and buildings
const g_TrainedColor = '[color="201 255 200"]';
const g_LostColor = '[color="255 213 213"]';
const g_KilledColor = '[color="196 198 255"]';

const g_BuildingsTypes = [ "total", "House", "Economic", "Outpost", "Military", "Fortress", "CivCentre", "Wonder" ];
const g_UnitsTypes = [ "total", "Infantry", "Worker", "Cavalry", "Champion", "Hero", "Ship", "Trader" ];
const g_ResourcesTypes = [ "food", "wood", "stone", "metal" ];

// Colors used for gathered and traded resources
const g_IncomeColor = '[color="201 255 200"]';
const g_OutcomeColor = '[color="255 213 213"]';

const g_InfiniteSymbol = "\u221E";

var g_CivData = loadCivData();
var g_Teams = [];

// TODO set g_PlayerCount as playerCounters.length
var g_PlayerCount = 0;

// Count players without team (or all if teams are not displayed)
var g_WithoutTeam = 0;
var g_GameData;

function selectPanel(panel)
{
	// TODO: move panel buttons to a custom parent object

	for (let button of Engine.GetGUIObjectByName("summaryWindow").children)
		if (button.name.endsWith("PanelButton"))
			button.sprite = "BackgroundTab";

	panel.sprite = "ForegroundTab";

	adjustTabDividers(panel.size);

	updatePanelData(g_ScorePanelsData[panel.name.substr(0, panel.name.length - "PanelButton".length)]);
}

function adjustTabDividers(tabSize)
{
	let leftSpacer = Engine.GetGUIObjectByName("tabDividerLeft");
	let rightSpacer = Engine.GetGUIObjectByName("tabDividerRight");

	leftSpacer.size = [
		20,
		leftSpacer.size.top,
		tabSize.left + 2,
		leftSpacer.size.bottom
	].join(" ");

	rightSpacer.size = [
		tabSize.right - 2,
		rightSpacer.size.top,
		"100%-20",
		rightSpacer.size.bottom
	].join(" ");
}

function updatePanelData(panelInfo)
{
	resetGeneralPanel();
	resetDataHelpers();
	updateGeneralPanelHeadings(panelInfo.headings);
	updateGeneralPanelTitles(panelInfo.titleHeadings);
	let rowPlayerObjectWidth = updateGeneralPanelCounter(panelInfo.counters);
	updateGeneralPanelTeams();

	let playerBoxesCounts = [ ];
	for (let i = 0; i < g_PlayerCount; ++i)
	{
		let playerState = g_GameData.playerStates[i+1];

		if (!playerBoxesCounts[playerState.team+1])
			playerBoxesCounts[playerState.team+1] = 1;
		else
			playerBoxesCounts[playerState.team+1] += 1;

		let positionObject = playerBoxesCounts[playerState.team+1] - 1;
		let rowPlayer = "playerBox[" + positionObject + "]";
		let playerNameColumn = "playerName[" + positionObject + "]";
		let playerColorBoxColumn = "playerColorBox[" + positionObject + "]";
		let playerCivicBoxColumn = "civIcon[" + positionObject + "]";
		let playerCounterValue = "valueData[" + positionObject + "]";

		if (playerState.team != -1)
		{
			rowPlayer = "playerBoxt[" + playerState.team + "][" + positionObject + "]";
			playerNameColumn = "playerNamet[" + playerState.team + "][" + positionObject + "]";
			playerColorBoxColumn = "playerColorBoxt[" + playerState.team + "][" + positionObject + "]";
			playerCivicBoxColumn = "civIcont[" + playerState.team + "][" + positionObject + "]";
			playerCounterValue = "valueDataTeam[" + playerState.team + "][" + positionObject + "]";
		}

		let colorString = "color: " +
				Math.floor(playerState.color.r * 255) + " " +
				Math.floor(playerState.color.g * 255) + " " +
				Math.floor(playerState.color.b * 255);

		let rowPlayerObject = Engine.GetGUIObjectByName(rowPlayer);
		rowPlayerObject.hidden = false;
		rowPlayerObject.sprite = colorString + g_PlayerBoxAlpha;

		let boxSize = rowPlayerObject.size;
		boxSize.right = rowPlayerObjectWidth;
		rowPlayerObject.size = boxSize;

		let playerColorBox = Engine.GetGUIObjectByName(playerColorBoxColumn);
		playerColorBox.sprite = colorString + g_PlayerColorBoxAlpha;

		Engine.GetGUIObjectByName(playerNameColumn).caption = g_GameData.players[i+1].name;

		let civIcon = Engine.GetGUIObjectByName(playerCivicBoxColumn);
		civIcon.sprite = "stretched:" + g_CivData[playerState.civ].Emblem;
		civIcon.tooltip = g_CivData[playerState.civ].Name;

		updateCountersPlayer(playerState, panelInfo.counters, playerCounterValue);

		calculateTeamCounters(playerState);
	}

	let teamCounterFn = panelInfo.teamCounterFn;
	if (g_Teams && teamCounterFn)
		teamCounterFn(panelInfo.counters);
}

function startReplay()
{
	if (Engine.HasXmppClient())
		Engine.StopXmppClient();

	Engine.StartVisualReplay(g_GameData.replayDirectory);
	Engine.SwitchGuiPage("page_loading.xml", {
		"attribs": Engine.GetReplayAttributes(g_GameData.replayDirectory),
		"isNetworked": false,
		"playerAssignments": {
			"local": {
				"name": singleplayerName(),
				"player": -1
			}
		},
		"savedGUIData": "",
		"isReplay": true,
		"replaySelectionData": g_GameData.replaySelectionData
	});
}

function init(data)
{
	updateObjectPlayerPosition();
	g_GameData = data;

	let mapSize = data.mapSettings.Size && g_Settings.MapSizes.find(size => size.Tiles == data.mapSettings.Size);
	let mapType = g_Settings.MapTypes.find(mapType => mapType.Name == data.mapSettings.mapType);
	
	Engine.GetGUIObjectByName("timeElapsed").caption = sprintf(
		translate("Game time elapsed: %(time)s"), {
			"time": timeToString(data.timeElapsed)
	});

	Engine.GetGUIObjectByName("summaryText").caption = data.gameResult;

	Engine.GetGUIObjectByName("mapName").caption = sprintf(
		translate("%(mapName)s - %(mapType)s"), {
			"mapName": translate(data.mapSettings.Name),
			"mapType": mapSize ? mapSize.LongName : (mapType ? mapType.Title : "")
		});

	Engine.GetGUIObjectByName("replayButton").hidden = g_GameData.isInGame || !g_GameData.replayDirectory;

	// Panels
	g_PlayerCount = data.playerStates.length - 1;

	if (data.mapSettings.LockTeams)
	{
		// Count teams
		for (let t = 0; t < g_PlayerCount; ++t)
		{
			let playerTeam = data.playerStates[t+1].team;
			g_Teams[playerTeam] = (g_Teams[playerTeam] || 0) + 1;
		}

		if (g_Teams.length == g_PlayerCount)
			g_Teams = false;	// Each player has his own team. Displaying teams makes no sense.
	}
	else
		g_Teams = false;

	// Erase teams data if teams are not displayed
	if (!g_Teams)
	{
		for (let p = 0; p < g_PlayerCount; ++p)
			data.playerStates[p+1].team = -1;
	}

	g_WithoutTeam = g_PlayerCount;
	if (g_Teams)
	{
		// Count players without team (or all if teams are not displayed)
		for (let i = 0; i < g_Teams.length; ++i)
			g_WithoutTeam -= g_Teams[i] ? g_Teams[i] : 0;
	}

	selectPanel(Engine.GetGUIObjectByName("scorePanelButton"));
}
