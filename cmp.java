package strings;
public class cmp{
	public static void main(String [] args){
		String str1="Satish";
		String str2="Monu";
		boolean isCompare=false;
		
		
		for(int i=0;i<str1.length();i++){
			if(str1.charAt(i)!=str2.chartAt(i)){
				isCompare=false;
				break;
			}
			isCompare=true;
		}
		System.out.println("Both the strings are equal"+isCompare);
	}
}

