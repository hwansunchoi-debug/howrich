-- Create upload_files table to track uploaded data files
CREATE TABLE public.upload_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls')),
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_records_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed', 'partial')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for upload_files
ALTER TABLE public.upload_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for upload_files
CREATE POLICY "Users can manage their own upload files" 
ON public.upload_files 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_upload_files_updated_at
  BEFORE UPDATE ON public.upload_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add file_upload_id to transactions table to track which file each transaction came from
ALTER TABLE public.transactions 
ADD COLUMN file_upload_id UUID,
ADD CONSTRAINT fk_transactions_file_upload 
  FOREIGN KEY (file_upload_id) 
  REFERENCES public.upload_files(id) 
  ON DELETE SET NULL;