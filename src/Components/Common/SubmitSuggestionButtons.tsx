import * as React from "react";
import { Row, Col } from "react-bootstrap";
import { Campaign } from "../Common/Campaign";
import * as moment from "moment"
import * as _ from "lodash";
import { DataAdapter } from "./DataAdapter";
interface SubmitsuggestionButtonsState { Campaigns: Array<Campaign> }
export class SubmitSuggestionButtons extends React.Component<any, SubmitsuggestionButtonsState>
{
    state = { Campaigns: new Array<Campaign>() }

    componentWillMount() {
        var d = new DataAdapter();
        d.getAllCampaigns().then((a: Array<Campaign>) => {
            this.setState({ Campaigns: a });
        });
    }

    render() {
        if (this.state.Campaigns === undefined || this.state.Campaigns.length === 0) return null;
        var campaigns = _.orderBy(this.state.Campaigns, ['Placement'], ['asc']);
        return <Col md={6} mdPush={1} sm={8} xs={12} lg={5} lgPush={2}>
            {
                campaigns.map((c: Campaign, index: number) => {
                    if (moment(c.StartDate) <= moment() && moment() > moment(c.EndDate))
                        return;

                    var url = _spPageContextInfo.webAbsoluteUrl + "/SitePages/NyttForslag.aspx";

                    if (c.CompRef)
                        url += "?ref=" + c.CompRef;

                    if (c.Type === "Fortid")
                        url += (c.CompRef) ? "&type=p" : "?type=p";

                    return (
                        <a
                            key={index}
                            href={url}
                            className="btn green"
                            style={{ marginLeft: "4px" }}>{c.Text}</a>
                    );
                })
            }
        </Col>
    }
}