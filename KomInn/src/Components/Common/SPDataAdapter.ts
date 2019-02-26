/**
 * SPDataAdapter 
 * 
 * Data transmission and retrieval functions for interfacing SharePoint on-prem or in the cloud
 */

import { Suggestion } from "./Suggestion";
import { Person } from "./Person";
import { Comment } from "./Comment";
import { Status } from "./Status";
import { Tools } from "./Tools";
import { SustainabilityGoal } from "./SustainabilityGoal"; 
$.ajaxSetup({ headers: { "Accept": "application/json;odata=verbose" } })
import { Promise } from "es6-promise";
$.ajaxSetup({ headers: { "Accept": "application/json;odata=verbose" } })


interface UserProfileProperty {
    Key: string, Value: string, ValueType: string
}

interface SustainabilityGoalRestRequest { d:{results:[{Id:number, Title:string, IkonId:number}]}}
interface SustainabilityIconRestRequest { d:{results:[SustainabilityIconObject]} }
interface SustainabilityIconObject { File:{ServerRelativeUrl:string}, Id:number }
export class SPDataAdapter {
   
    /**
     * Sustainabilitygoals
     * Returns: Array of sustainabilitygoals with id's
     */
    static getSustainabilityGoals():Promise<Array<SustainabilityGoal>>
    {
        return new Promise( (resolve, reject) => { 
            var icons = new Array<SustainabilityIconObject>(); 
            $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Ikoner')/Items?$select=Id,File/ServerRelativeUrl&$expand=File").then(
                (result:SustainabilityIconRestRequest) => { 
                    icons = result.d.results.map( (s:SustainabilityIconObject) => s); 
                    
                    $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Baerekraftsmaal')/Items?$select=Title,Id,IkonId").then( 
                        (result:SustainabilityGoalRestRequest) => { 
                            var results = result.d.results.map( (r) => { 
                                var icon = icons.filter( (i) => i.Id === r.IkonId); 
                                
                                return { Id:r.Id, Title:r.Title, ImageSrc:(icon.length > 0) ? icon[0].File.ServerRelativeUrl : "" } as SustainabilityGoal;
                            });
                            resolve(results); 
                        }
                     );


                })

                }
              )
    }
   
    /**
   * Upload image
   * Returns: Uploaded image path
   */
    static uploadImage(buffer: any, filename: string): Promise<any> {
        return new Promise((resolve, reject) => {
            Tools.getFileBuffer(buffer).then(() => {              
                var url = _spPageContextInfo.webAbsoluteUrl +
                    "/_api/web/lists/getbytitle('Bilder')/rootfolder/files" +
                    "/add(url='" + filename + "', overwrite=true)";
                jQuery.ajax({
                    url: url,
                    type: "POST",
                    data: buffer,
                    processData: false,
                    success: () => resolve(),
                    error: () => reject(),
                    headers: {
                        "accept": "application/json;odata=verbose",
                        "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                        "content-length": buffer.byteLength
                    }
                });
            });
        });

    }
    /**
     * Get all suggestions
     * Param: (optional) Status: Gets all with assigned status
     * Param: (optional) Count: Gets a set count
     * Returns: Array with all suggestions, sorted by date. 
     */
    static getAllSuggestions(type?: Status, top?: number, customFilter?: string, customSort?: string): Promise<Array<Suggestion>> {
        return new Promise((resolve, reject) => {
            var numResults = (top == null) ? 100 : top;
            var query = (type == null) ? "" : "&$filter=Status ne 'Sendt inn' and Status eq '" + Tools.statusToString(type) + "'";
            var sortStr = "&$orderby=Created desc";
            if (customSort != null)
                sortStr = customSort;

            if (customFilter != null)
                query = customFilter;

            this.getSustainabilityGoals().then( (susgoals:Array<SustainabilityGoal>) => { 
                var suggestions = new Array<Suggestion>();
                $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Forslag')/Items?$select=*,Author/Id,InspiredBy/Id,InspiredBy/Title&$expand=InspiredBy,Author&$top=" + numResults + sortStr + query).then((result: any) => 
                {
                    var results = result.d.results;
                    for (var i = 0; i < results.length; i++) {
                        var p = new Person();
                        var s = new Suggestion();
                        p.Name = results[i].Name;
                        p.Address = results[i].Address;
                        p.City = results[i].City;
                        p.CountyCode = results[i].CountyCode;
                        p.Department = results[i].Department;
                        p.MailAddress = results[i].MailAddress;
                        p.Manager = results[i].ManagerId;
                        p.Telephone = results[i].Telephone;
                        p.Zipcode = results[i].Zipcode;
                        s.Id = results[i].Id;
                        s.Challenges = results[i].Challenges;
                        s.Image = Tools.IsNull(results[i].Image) ? "" : results[i].Image;
                        s.Likes = Tools.IsNull(results[i].Likes) ? 0 : results[i].Likes;
                        s.Location = results[i].Location;
                        s.NumberOfComments = Tools.IsNull(results[i].NumberOfComments) ? 0 : results[i].NumberOfComments;
                        s.Status = Tools.convertStatus(results[i].Status);
                        s.Submitter = p;
                        s.SuggestedSolution = results[i].SuggestedSolution;
                        s.Summary = results[i].Summary;
                        s.InspiredBy = (results[i].InspiredBy != null) ? results[i].InspiredBy.results : null;
                        if (results[i].Tags != null)
                            s.Tags = results[i].Tags.results;

                        s.Title = results[i].Title;
                        s.UsefulForOthers = results[i].UsefulForOthers;
                        s.UsefulnessType = results[i].UsefulnessType;
                        s.Created = new Date(results[i].Created);
                        s.SendTilKS = results[i].SendToKS;
                        
                        var goals = results[i].B_x00e6_rekraftsm_x00e5_lId.results; 
                        if(goals)
                        {
                            for(let goal of goals)
                            {
                                s.SustainabilityGoals.push(susgoals.filter( (s) => s.Id === goal )[0]);
                            }
                        }
                        
                        suggestions.push(s);
                    }
                    resolve(suggestions);
                });

            })


            
        });
    }

    public static getMySuggestions(): Promise<Array<Suggestion>> {
        var userId = _spPageContextInfo.userId;
        return this.getAllSuggestions(null, null, "&$filter=Author/Id eq " + userId);
    }

    public static getSuggestionByTitle(title: string): Promise<Array<Suggestion>> {
        return this.getAllSuggestions(null, null, "&$filter=substringof('" + encodeURI(title) + "', Title) and Status ne 'Sendt inn'");
    }

    public static getMyUserProfile(): Promise<Person> {
        return new Promise((resolve, reject) => {
            $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/SP.UserProfiles.PeopleManager/GetMyProperties")
                .then((result: any) => {
                    var p = new Person();
                    p.Id = _spPageContextInfo.userId;
                    p.ProfileImageUrl = result.d.PictureUrl;
                    p.Name = result.d.DisplayName;
                    p.Address = this.getUserProfileProperty("Office", result.d.UserProfileProperties.results);
                    p.Department = this.getUserProfileProperty("SPS-JobTitle", result.d.UserProfileProperties.results);
                    p.MailAddress = result.d.Email;
                    p.Branch = this.getUserProfileProperty("Department", result.d.UserProfileProperties.results);
                    p.ManagerLoginName = this.getUserProfileProperty("Manager", result.d.UserProfileProperties.results);
                    p.Telephone = this.getUserProfileProperty("CellPhone", result.d.UserProfileProperties.results);

                    if (p.ManagerLoginName == null || p.ManagerLoginName.length <= 0) {
                        resolve(p);
                        return;
                    }
                    this.ensureUser(p.ManagerLoginName).then((result: any) => {
                        p.Manager = new Person();
                        p.Manager.Id = result.d.Id;
                        p.Manager.Name = result.d.Title;
                        resolve(p);
                        return;
                    });
                });
        })
    }

    /**
     * Returns the ID of a resolved user, or -1 if not found.  
     */
    private static ensureUser(loginName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            var payload = { 'logonName': loginName };
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/ensureuser",
                type: "POST",
                contentType: "application/json;odata=verbose",
                data: JSON.stringify(payload),
                headers: {
                    "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                    "accept": "application/json;odata=verbose"
                }
            }).then((data: any) => { resolve(data); })
                .fail((err: any) => { reject(); });
        });
    }

    private static getUserProfileProperty(property: string, userProfileProperties: Array<UserProfileProperty>): string {
        for (let prop of userProfileProperties) {
            if (prop.Key == property) {
                return prop.Value;
            }
        }
        return "";

    }

    /**
     * Submit suggestions
     * Returns: (Suggestion) The submitted suggestion
     */
    static submitSuggestion(suggestion: Suggestion): Promise<Suggestion> {
        return new Promise((resolve, reject) => {
            var s = suggestion;
            var context = SP.ClientContext.get_current();
            var list = context.get_web().get_lists().getByTitle("Forslag");
            var itemcreationinfo = new SP.ListItemCreationInformation();
            var item = list.addItem(itemcreationinfo);
            item.set_item("Title", s.Title);
            item.set_item("Summary", s.Summary);
            item.set_item("Challenges", s.Challenges);
            item.set_item("SuggestedSolution", s.SuggestedSolution);
            item.set_item("Location", s.Location);
            item.set_item("UsefulForOthers", s.UsefulForOthers);
            item.set_item("UsefulnessType", s.UsefulnessType);
            item.set_item("CountyCode", s.Submitter.CountyCode);
            item.set_item("Name", s.Submitter.Name);
            item.set_item("Address", s.Submitter.Address);
            item.set_item("MailAddress", s.Submitter.MailAddress);
            item.set_item("Telephone", s.Submitter.Telephone);
            item.set_item("Zipcode", s.Submitter.Zipcode);
            item.set_item("City", s.Submitter.City);
            item.set_item("Department", s.Submitter.Department);
            item.set_item("Image", s.Image);
            item.set_item("Status", Tools.statusToString(Status.Submitted));
            item.set_item("CompRef", GetUrlKeyValue("ref"));
            item.set_item("SendToKS", false);
            item.set_item("IsPast", (GetUrlKeyValue("type") === "p"));

            if (s.Submitter.Manager != null && s.Submitter.Manager.Id != -1) {
                var manager = new SP.FieldUserValue();
                manager.set_lookupId(s.Submitter.Manager.Id);
                item.set_item("Manager", s.Submitter.Manager.Id);
            }
            if (s.InspiredBy != null) {
                var inspiredByField = new Array<SP.FieldLookupValue>();
                for (let v of s.InspiredBy) {
                    var lookup = new SP.FieldLookupValue();
                    lookup.set_lookupId(v.Id);
                    inspiredByField.push(lookup);
                }
                item.set_item("InspiredBy", inspiredByField);
            }

            if(s.SustainabilityGoals.length > 0)
            {
                var sustainabilityGoalsField = new Array<SP.FieldLookupValue>(); 
                for(let v of s.SustainabilityGoals)
                {
                    var lookup = new SP.FieldLookupValue();
                    lookup.set_lookupId(v.Id);
                    sustainabilityGoalsField.push(lookup); 
                }
                item.set_item("B_x00e6_rekraftsm_x00e5_l", sustainabilityGoalsField); 
            }

            item.update();
            context.load(item);
            context.executeQueryAsync(
                (success: any) => {
                    resolve(s);
                },
                (fail: any, error: any) => {
                    console.log(error.get_message());
                    reject(error.get_message());
                });

        });
    }

    /**
     * Get comments for suggestion 
     * Returns: The suggestion with comments loaded
     */
    static getCommentsForSuggestion(suggestion: Suggestion): Promise<Suggestion> {
        return new Promise((resolve, reject) => {
            $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Kommentarer')/Items?$orderby=Created desc&$filter=SuggestionId eq " + suggestion.Id + "").then(
                (result: any) => {
                    var c = new Array<Comment>();
                    for (let item of result.d.results) {
                        var comment = new Comment();
                        comment.Created = new Date(item.Created);
                        comment.CreatedBy = item.Title;
                        comment.Image = item.Image;
                        comment.SuggestionId = item.SuggestionId;
                        comment.Text = item.Text;
                        c.push(comment);
                    }
                    var s = new Suggestion();
                    s = suggestion;
                    s.Comments = c;
                    return resolve(s);

                })

        });
    }

    /**
     * Submit comment for suggestion
     * Returns: The suggestion with the added comment
     */
    static submitCommentForSuggestion(text: string, suggestion: Suggestion): Promise<any> {
        return new Promise((resolve, reject) => {
            var s = suggestion;
            var context = SP.ClientContext.get_current();
            var list = context.get_web().get_lists().getByTitle("Kommentarer");
            var itemcreationinfo = new SP.ListItemCreationInformation();
            var item = list.addItem(itemcreationinfo);
            this.getMyUserProfile().then((person: Person) => {
                item.set_item("Title", person.Name);
                item.set_item("Text", text);
                item.set_item("Image", person.ProfileImageUrl);
                item.set_item("SuggestionId", suggestion.Id);
                item.update();
                context.load(item);
                context.executeQueryAsync(
                    (success: any) => {
                        this.increaseCommentCount(context, s).then(() => {
                            resolve();
                        });
                    },
                    (fail: any, error: any) => {
                        reject(error.get_message());
                    });
            });
        });
    }

    static increaseCommentCount(ctx: SP.ClientContext, s: Suggestion): Promise<any> {
        return new Promise((resolve, reject) => {
            var list = ctx.get_web().get_lists().getByTitle("Forslag");
            var item = list.getItemById(s.Id);
            ctx.load(item);
            ctx.executeQueryAsync(() => {
                var vals = item.get_fieldValuesAsText();
                ctx.load(vals);
                ctx.executeQueryAsync(() => {
                    var val = vals.get_item("NumberOfComments");
                    var count = 0;
                    if (val.length <= 0 || val === "0")
                        count = 0;
                    else
                        count = parseInt(val);

                    count++;
                    item.set_item("NumberOfComments", count);
                    item.update();
                    list.update();
                    ctx.executeQueryAsync(() => {
                        resolve();
                    }, () => reject() );
                });
            })
        });
    }

    /**
     * UpdateLike for suggestion
     * Returns: The suggestion with updated like count (Suggestion)
     */
    static updateLike(suggestion: Suggestion): Promise<Suggestion> {
        return new Promise((resolve, reject) => {
            // Get existing like 
            $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Likes')/Items?$filter=(Forslag eq " + suggestion.Id + " and Author/Id eq " + _spPageContextInfo.userId + ")&$select=Id,Author/Id&$expand=Author").then(
                (result: any) => {
                    if (result.d.results.length <= 0) {
                        this.addLike(suggestion).then(
                            () => {
                                this.UpdateLikeCountInList(suggestion, 1).then(() => {
                                    //console.log("+1", suggestion);
                                    var s = suggestion;
                                    s.Likes++;
                                    resolve(s);
                                })
                            });
                        return;
                    }
                    this.removeLike(result.d.results[0].Id).then(
                        () => {
                            this.UpdateLikeCountInList(suggestion, -1).then(() => {
                                var s = suggestion;
                                s.Likes--;
                                resolve(s);
                            })
                        });
                });

        });
    }

    private static UpdateLikeCountInList(suggestion: Suggestion, count: number): Promise<{}> {
        return new Promise((resolve, reject) => {
            var context = SP.ClientContext.get_current();
            var list = context.get_web().get_lists().getByTitle("Forslag");
            var item = list.getItemById(suggestion.Id);
            item.refreshLoad();
            context.load(item, 'FieldValuesAsText');
            context.executeQueryAsync(() => {
                var current = item.get_fieldValuesAsText();
                var cnt = current.get_item("Likes");

                var x = 0;
                if (cnt.length <= 0 || cnt === "0")
                    x = 1;
                else
                    x = Math.floor(parseInt(cnt)) + count;

                item.refreshLoad();

                item.set_item("Likes", x);
                item.update();

                context.executeQueryAsync(() => {
                    resolve();
                },
                    (err: any, b: any) => {
                        console.log(b.get_message());
                        reject(err);
                    });
            });
        });
    }

    private static removeLike(id: number): Promise<Suggestion> {
        return new Promise((resolve, reject) => {
            var context = SP.ClientContext.get_current();
            var list = context.get_web().get_lists().getByTitle("Likes");
            var item = list.getItemById(id);
            item.deleteObject();
            context.executeQueryAsync(
                (success: any) => {
                    resolve();
                },
                (fail: any, error: any) => {
                    reject(error.get_message());
                });

        });
    }

    private static addLike(suggestion: Suggestion): Promise<Suggestion> {
        return new Promise((resolve, reject) => {
            var s = suggestion;
            var context = SP.ClientContext.get_current();
            var list = context.get_web().get_lists().getByTitle("Likes");
            var itemcreationinfo = new SP.ListItemCreationInformation();
            var item = list.addItem(itemcreationinfo);
            item.set_item("Forslag", suggestion.Id);
            item.update();
            context.load(item);
            context.executeQueryAsync(
                (success: any) => {
                    resolve();
                },
                (fail: any, error: any) => {
                    reject(error.get_message());
                });
        });
    }

    public static getCityAndCountryCode(person: Person): Promise<Person> {
        return new Promise((resolve, reject) => {
            var p = person;
            $.get(_spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Kommunenumre')/Items?$filter=Postnummer eq '" + person.Zipcode + "'&$select=Kommunenummer,Sted&$top=1").then(
                (result: any) => {
                    if (result.d.results.length <= 0) {
                        resolve(p);
                        return;
                    }
                    p.CountyCode = result.d.results[0].Kommunenummer;
                    p.City = result.d.results[0].Sted;
                    resolve(p);
                });

        });
    }

    /**
     * Submit to Induct
     * Submits the suggestion to Induct
     * @returns string with object ID from Induct  
     */

    public static submitToInduct(suggestion: Suggestion): Promise<string> {
        return new Promise((resolve, reject) => {
            if (suggestion.SendTilKS) {
                reject("Forslaget er allerede sendt til KS.");
                return;
            }
            var data = {
                title: suggestion.Title,
                description: this.suggestionAsHtml(suggestion)
            }
            // Get Client ID from configuration
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('InductKonfigurasjon')/Items",
                headers: { "Accept": "application/json;odata=verbose" },
            }).done((r: any) => {
                if (r.d.results.length <= 0) {
                    reject("Konfigurasjon mangler.");
                    return;
                }
                var clientID = r.d.results[0].KlientID;
                // Post to Induct API
                $.ajax({
                    url: "https://api.induct.no/v1/" + clientID + "/initiatives/ideas",
                    contentType: "application/json",
                    data: JSON.stringify(data),
                    type: "POST"
                }).done((s: any) => {
                    // Set "Send to KS" to true on the item.
                    var updObj = {
                        '__metadata': { 'type': 'SP.Data.ForslagItem' },
                        SendToKS: true
                    }

                    $.ajax({
                        url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Forslag')/items("+suggestion.Id+")",
                        method: "POST",
                        contentType: "application/json;odata=verbose",
                        data: JSON.stringify(updObj),
                        headers: {
                            "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                            "accept": "application/json;odata=verbose",
                            "IF-MATCH": "*",
                            "X-HTTP-Method": "MERGE"
                        }
                    }).then((data) => { resolve(s.id) })
                        .fail((a, b) => { console.log(a, b.message); reject(); });
                });
            });
        });
    }


    
    private static suggestionAsHtml(s: Suggestion) {
        return `
        <b>Sammendrag</b>
        <p>${s.Summary}</p>
        <br/><br/>
        <b>Utfordringer</b>
        <p>${s.Challenges}</p>
        <br/><br/>
        <b>Løsningforslag</b>
        <p>${s.SuggestedSolution}</p>
        <br/><br/>
        <b>Nyttetype</b>
        <p>${s.UsefulnessType}</p>
        `;
    }
}
